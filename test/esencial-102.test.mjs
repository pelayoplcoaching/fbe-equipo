// FBE Esencial, migración 102, contra el esquema real (PGlite, con RLS): la espera. Cuántos empiezan el mismo lunes (solo el
// número, con tres o más), «Listos para el lunes» del panel (sus días, su gimnasio y su primera semana en
// esencial_alta_estado) y la nota de sus kilos de partida (tipo 'partida', nada de salud).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as datos from '../web/src/datos/api-esencial.js';
import { listosLunes } from '../web/src/logica/esencial-espera.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) { console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)'); process.exit(0); }
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
const hoy = hoyISO(), lunes = lunesDe(hoy), lunes2 = sumarDias(lunes, 7), lunes3 = sumarDias(lunes, 14);
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 102;');
await db.exec(SQL('102_esencial_espera.sql'));
await db.exec(SQL('102_esencial_espera.sql'));   // (se puede repetir)

console.log('La 102');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.esencial_companeros()', 'execute') a, has_function_privilege('authenticated', 'public.esencial_companeros()', 'execute') u,
  has_function_privilege('anon', 'public.esencial_alta_estado()', 'execute') ea, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(priv.a === false && priv.u === true && priv.ea === false && Number(priv.n) === 102, 'sin sesión no se puede preguntar nada; con sesión, cuántos empiezan contigo; la base queda en la 102');
check((SQL('102_esencial_espera.sql').match(/create table|drop table|drop function/g) || []).length === 0, 'no crea ni borra tablas ni funciones (solo una restricción y dos funciones nuevas o al día)');
{
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.esencial_alta_estado()'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f097 = de(SQL('097_esencial_alta_avisos.sql')), f102 = de(SQL('102_esencial_espera.sql'));
  const claves = (f) => [...f.matchAll(/'([a-z_]+)', /g)].map((m) => m[1]);
  check(claves(f097).every((k) => claves(f102).includes(k)) && ['dias', 'gimnasio', 'primera_semana'].every((k) => claves(f102).includes(k)), 'esencial_alta_estado: todo lo de la 097 y tres datos más (sus días, su gimnasio, su primera semana)');
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes2 });
alta.dora = await api.crearAtletaEsencial({ nombre: 'dora Prueba', email: 'dora@test', inicio: lunes3 });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla', 'dora']) await entrar(n, alta[n].codigo);
await entrar('lucas', codLucas);

console.log('\nCuántos empezáis (71)');
await como('ana');
check((await datos.companeros(b)) === 3, 'Ana: empezáis 3 el mismo lunes (ella, Berta y Carla)');
await como('dora');
check((await datos.companeros(b)) === null, 'Dora, sola en su lunes: nada (con menos de tres no se dice)');
await como('lucas');
check((await datos.companeros(b)) === null, 'quien lleva seguimiento: nada');
await db.exec(superusuario);
await db.query(`update atletas set estado = 'baja' where id = $1`, [id.carla]);
await como('ana');
check((await datos.companeros(b)) === null, 'con una baja, quedan dos: ya no se dice');
await db.exec(superusuario);
await db.query(`update atletas set estado = 'activo' where id = $1`, [id.carla]);

console.log('\nSu gimnasio y sus kilos de partida (63 y 70)');
await como('ana');
check((await datos.gimnasioMirado(b, id.ana)) === false, 'Ana aún no ha mirado su gimnasio');
await datos.marcarGimnasio(b, id.ana, ['x']);
await datos.marcarGimnasio(b, id.ana, ['x']);
check((await datos.gimnasioMirado(b, id.ana)) === true && (await datos.notas(b, id.ana, 'gimnasio')).length === 1, 'lo marca (una sola nota, aunque lo toque dos veces)');
await db.exec(superusuario);
const ej = [];
for (const nombre of ['Jalón de prueba (102)', 'Remo de prueba (102)']) ej.push((await db.query(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}') returning id`, [nombre])).rows[0].id);
await como('ana');
await datos.apuntarKilosPartida(b, id.ana, { [ej[0]]: 40 });
await datos.apuntarKilosPartida(b, id.ana, { [ej[0]]: 42.5, [ej[1]]: 20 });
const k = await datos.kilosPartida(b, id.ana);
check(k?.[ej[0]] === 42.5 && k?.[ej[1]] === 20 && (await datos.notas(b, id.ana, 'partida')).length === 1, 'sus kilos de partida: se guardan los últimos (una nota)');
await como('berta');
check((await datos.kilosPartida(b, id.berta)) === null && (await b.select('esencial_notas', {})).length === 0, 'Berta no ve las notas de Ana');
let e = await falla(() => b.insert('esencial_notas', [{ atleta_id: id.berta, tipo: 'salud', datos: {} }]));
check(!!e, 'un tipo que no existe no entra');
await como('lucas');
e = await falla(() => b.insert('esencial_notas', [{ atleta_id: id.lucas, tipo: 'partida', datos: { kilos: {} } }]));
check(!!e, 'quien lleva seguimiento no apunta kilos de partida aquí');

console.log('\nListos para el lunes (77)');
// Ana: con plan, sus días puestos; Berta: con plan, sin días
await db.exec(superusuario);
const ejId = (await db.query(`insert into ejercicios (nombre, grupos_musculares, tipo) values ('Prensa de prueba (102)', '{}', '{multiarticular}') returning id`)).rows[0].id;
for (const n of ['ana', 'berta']) {
  const bl = (await db.query(`insert into bloques (es_plantilla, atleta_id, nombre, estado, fecha_inicio, numero) values (false, $1, 'Primeras 4 semanas', 'planificado', $2, 1) returning id`, [id[n], lunes2])).rows[0].id;
  const w = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, lunes2])).rows[0].id;
  for (let i = 1; i <= 2; i++) {
    const s = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, dia_previsto) values ($1, $2, $3, 'fuerza', false, $4) returning id`, [w, i, `Día ${i}`, n === 'ana' ? sumarDias(lunes2, i === 1 ? 0 : 3) : null])).rows[0].id;
    await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, 1, 1, 10, 12)`, [s, ejId]);
  }
}
await db.query(`update atletas set esencial_alternativas = jsonb_build_object($2::text, $3::text) where id = $1`, [id.berta, ejId, ej[0]]);
await como('ana');
e = await falla(() => api.esencialAltaEstado());
check(!!e, 'el alta de cada uno, solo el coach');
await como('coach');
const filas = await api.esencialAltaEstado();
const de = (n) => filas.find((x) => x.atleta_id === id[n]);
check(de('ana').dias === true && de('ana').gimnasio === true && String(de('ana').primera_semana).slice(0, 10) === lunes2, 'Ana: sus días puestos, su gimnasio mirado y su primera semana');
check(de('berta').dias === false && de('berta').gimnasio === true, 'Berta: sin días (pero con una alternativa para siempre: su gimnasio, mirado)');
check(de('carla').dias === null && de('carla').gimnasio === false && de('carla').primera_semana === null, 'Carla, sin plan: nada de días ni de primera semana');
check(['inicio', 'invitado_en', 'activado_en', 'push', 'email', 'cuestionario_en', 'resultado', 'plan_inicio', 'primera_sesion'].every((k2) => k2 in de('ana')), 'y todo lo de antes, igual');
const vivos = new Map(['ana', 'berta', 'carla', 'dora'].map((n) => [id[n], n]));
const l = listosLunes(filas, vivos, hoy);
check(l && l.proximo === lunes2 && l.total === 3 && l.lista.find((x) => x.nombre === 'berta').falta.includes('días') && l.lista.find((x) => x.nombre === 'carla').falta.includes('cuestionario'),
  `«Listos para el lunes»: los tres del lunes que viene, con lo que le falta a cada uno (${l?.lista.map((x) => `${x.nombre}: ${x.falta.join('/')}`).join('; ')})`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
