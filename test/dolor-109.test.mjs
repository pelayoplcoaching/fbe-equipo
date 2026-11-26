// El motor de molestias de FBE Esencial, migración 109, contra el esquema real (PGlite, con RLS): la tabla de molestias de
// siempre admite el valor de 0 a 10 (con la intensidad de siempre al lado) y las zonas del cuestionario de lesiones;
// dolor_registros (cada uno ve las suyas, el coach todas, nadie las escribe a mano) y apuntar_dolor() con quién puede, su
// consentimiento de salud, sus límites y la sesión, que tiene que ser suya. Y que el estado de cada zona sale de lo guardado.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as dol from '../web/src/datos/api-dolor.js';
import { estadoZonas } from '../web/src/logica/dolor.js';
import { hoyISO, sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 109;');
await db.exec(SQL('109_dolor.sql'));
await db.exec(SQL('109_dolor.sql'));   // (se puede repetir)

console.log('La 109');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.apuntar_dolor(jsonb, uuid)', 'execute') a1,
  has_function_privilege('authenticated', 'public.apuntar_dolor(jsonb, uuid)', 'execute') u1,
  (select relrowsecurity from pg_class where oid = 'public.dolor_registros'::regclass) rls, (select max(numero) from fbe_migraciones) n,
  (select count(*) from information_schema.columns where table_name = 'molestias' and column_name = 'valor') col`)).rows[0];
check(!priv.a1 && priv.u1 && priv.rls && Number(priv.n) === 109 && Number(priv.col) === 1, 'sin sesión, nada; el registro, con RLS; la de molestias, con su valor; la base queda en la 109');

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const lunes = lunesDe(hoyISO());
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Dolor`, email: `${n}@test`, inicio: sumarDias(lunes, -14) });
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla']) await entrar(n, alta[n].codigo);
// Carla retira su consentimiento de salud; Ana y Berta, una sesión cada una (para apuntar con la sesión)
await db.exec(superusuario);
await db.query(`update consentimientos set revocado_en = now() where tipo = 'datos_salud' and perfil_id = (select perfil_id from atletas where id = $1)`, [id.carla]);
const sesionDe = async (atleta) => {
  const bl = (await db.query(`insert into bloques (atleta_id, nombre, estado) values ($1, 'Plan', 'activo') returning id`, [atleta])).rows[0].id;
  const se = (await db.query(`insert into semanas (bloque_id, numero, programacion) values ($1, 1, 'programada') returning id`, [bl])).rows[0].id;
  return (await db.query(`insert into sesiones (semana_id, orden, nombre) values ($1, 1, 'Día 1') returning id`, [se])).rows[0].id;
};
const sAna = await sesionDe(id.ana), sBerta = await sesionDe(id.berta);

console.log('\nSu check-in, de 0 a 10 (la tabla de molestias de siempre)');
await como('ana');
check(await dol.hay109(b) === true, 'la app ve que está la 109');
await api.guardarCheckin(id.ana, lunes, { energia: 3 }, { rodilla: 4, hombro: 7, cuello: 0 }, null, { escala10: true });
const mc = await dol.molestiasCheckin(b, id.ana);
const rod = mc.find((m) => m.zona === 'rodilla'), hom = mc.find((m) => m.zona === 'hombro');
check(mc.length === 2 && Number(rod.valor) === 4 && Number(rod.intensidad) === 2 && Number(hom.valor) === 7 && Number(hom.intensidad) === 3,
  'con las zonas del cuestionario de lesiones: la rodilla a 4 (moderada) y el hombro a 7 (grave); el cuello a 0, nada');
await api.guardarCheckin(id.ana, lunes, { energia: 3 }, { rodilla: 2, hombro: 0 }, null, { escala10: true });
const mc2 = await dol.molestiasCheckin(b, id.ana);
check(mc2.length === 1 && Number(mc2[0].valor) === 2 && Number(mc2[0].intensidad) === 1, 'al cambiarlo: la rodilla baja a 2 (leve) y el hombro se quita');
await api.guardarCheckin(id.ana, sumarDias(lunes, -7), { energia: 3 }, { cuadriceps: 2 }, null);
check((await dol.molestiasCheckin(b, id.ana)).some((m) => m.zona === 'cuadriceps' && m.valor == null && Number(m.intensidad) === 2), 'las de antes (de 0 a 3, sin valor) siguen valiendo');
await db.exec(superusuario);
const mal = async (sql, m) => check(/molestias_valor_valido|molestias_zona_check|check constraint/i.test((await falla(() => db.query(sql, [id.ana, lunes])))?.message || ''), m);
await mal(`insert into molestias (atleta_id, semana_inicio, zona, valor, intensidad) values ($1, $2, 'codo', 4, 3)`, 'un valor que no cuadra con la intensidad: no');
await mal(`insert into molestias (atleta_id, semana_inicio, zona, valor, intensidad) values ($1, $2, 'codo', 11, 3)`, 'más de 10: no');
await mal(`insert into molestias (atleta_id, semana_inicio, zona, intensidad) values ($1, $2, 'pie', 1)`, 'una zona que no existe: no');

console.log('\nApuntar una molestia (apuntar_dolor)');
await como('ana');
const a1 = await dol.apuntarDolor(b, { zona: 'rodilla', valor: 4, momento: 'ahora' });
check(a1?.atleta_id === id.ana && a1.zona === 'rodilla' && Number(a1.valor) === 4 && a1.momento === 'ahora' && a1.fecha === hoyISO() && a1.sesion_id === null,
  'Ana apunta la rodilla a 4, ahora, con la fecha de hoy');
const a2 = await dol.apuntarDolor(b, { zona: 'rodilla', valor: 5, momento: 'ahora' });
check(a2.id === a1.id && Number(a2.valor) === 5 && (await dol.registros(b, id.ana)).length === 1, 'si la vuelve a apuntar el mismo día y en el mismo momento, se queda la última');
const a3 = await dol.apuntarDolor(b, { zona: 'rodilla', valor: 3, momento: 'despues', sesion_id: sAna });
check(a3.sesion_id === sAna && a3.id !== a1.id, 'después de una sesión suya, con la sesión');
check(/no es tuya/.test((await falla(() => dol.apuntarDolor(b, { zona: 'rodilla', valor: 3, momento: 'antes', sesion_id: sBerta })))?.message || ''), 'con una sesión de otra: no');
const mias = await dol.registros(b, id.ana);
check(mias.length === 2 && mias.every((x) => typeof x.valor === 'number'), 'y las lee: dos, con su valor como número');
const malas = async (p, m) => check(/no vale/.test((await falla(() => b.rpc('apuntar_dolor', { p })))?.message || ''), m);
await malas({ zona: 'pie', valor: 3, momento: 'ahora' }, 'una zona que no es del cuestionario de lesiones: no');
await malas({ zona: 'cuadriceps', valor: 3, momento: 'ahora' }, '(ni una de las musculares del check-in de siempre)');
await malas({ zona: 'rodilla', valor: 11, momento: 'ahora' }, 'más de 10: no');
await malas({ zona: 'rodilla', valor: -1, momento: 'ahora' }, 'menos de 0: no');
await malas({ zona: 'rodilla', valor: 4.5, momento: 'ahora' }, 'con decimales: no');
await malas({ zona: 'rodilla', valor: '4', momento: 'ahora' }, 'un valor que no es un número: no');
await malas({ zona: 'rodilla', valor: 4, momento: 'checkin' }, 'el momento «check-in» (ese va en su check-in): no');
await malas({ zona: 'rodilla', valor: 4, momento: 'ahora', sesion_id: 'no-es-un-id' }, 'una sesión que no es un identificador: no');

console.log('\nQuién las ve y quién las escribe');
check(/row-level security|permission|42501|violates/i.test((await falla(() => b.insert('dolor_registros', { atleta_id: id.ana, zona: 'codo', valor: 2, momento: 'ahora' })))?.message || '')
  && !(await dol.registros(b, id.ana)).some((x) => x.zona === 'codo'), 'a mano, Ana no las escribe (solo con apuntar_dolor)');
await como('berta');
check((await dol.registros(b, id.ana)).length === 0 && (await dol.molestiasCheckin(b, id.ana)).length === 0, 'Berta no ve las de Ana');
check(/propias/.test((await falla(() => b.rpc('apuntar_dolor', { p: { zona: 'codo', valor: 2, momento: 'ahora' }, p_atleta: id.ana })))?.message || ''), 'ni las puede apuntar por ella');
await como('carla');
check(/consentimiento/.test((await falla(() => dol.apuntarDolor(b, { zona: 'codo', valor: 2, momento: 'ahora' })))?.message || ''), 'sin su consentimiento de salud, Carla no puede apuntarlas');
await como('coach');
check((await dol.registros(b, id.ana)).length === 2, 'el coach las ve');
const ac = await dol.apuntarDolor(b, { zona: 'hombro', valor: 6, momento: 'ahora' }, id.berta);
check(ac.atleta_id === id.berta && Number(ac.valor) === 6, 'y puede apuntar una por un atleta (con su consentimiento)');

console.log('\nEl estado de cada zona, con lo guardado');
await como('ana');
const est = estadoZonas({ registros: await dol.registros(b, id.ana), checkins: await dol.molestiasCheckin(b, id.ana), hoy: hoyISO() });
const r = est.find((z) => z.zona === 'rodilla');
check(r && r.valor === 3 && r.semaforo === 'ambar' && r.abierta && !est.some((z) => z.zona === 'cuadriceps'),
  'la rodilla, abierta en ámbar (lo último, 3 después de la sesión); las zonas musculares de antes no cuentan');

console.log('\nBorrarlas');
await como('berta');
await dol.borrarDolor(b, id.ana).catch(() => null);
await como('coach');
check((await dol.registros(b, id.ana)).length === 2, 'Berta no puede borrar las de Ana');
await como('ana');
await dol.borrarDolor(b, id.ana, a1.id);
check((await dol.registros(b, id.ana)).length === 1, 'Ana borra una suya');
await dol.borrarDolor(b, id.ana);
check((await dol.registros(b, id.ana)).length === 0 && (await dol.molestiasCheckin(b, id.ana)).length > 0, 'y todas (las de su check-in se quedan)');
await db.exec(superusuario);
await db.query(`insert into dolor_registros (atleta_id, zona, valor, momento) values ($1, 'codo', 2, 'ahora')`, [id.carla]);
await como('carla');
await dol.borrarDolor(b, id.carla);
await db.exec(superusuario);
check(Number((await db.query('select count(*) n from dolor_registros where atleta_id = $1', [id.carla])).rows[0].n) === 0, 'también sin consentimiento (Carla borra las suyas)');

console.log('\nSi se borra la sesión o el atleta');
await db.query(`insert into dolor_registros (atleta_id, zona, valor, momento, sesion_id) values ($1, 'cadera', 3, 'antes', $2)`, [id.berta, sBerta]);
await db.query('delete from sesiones where id = $1', [sBerta]);
check((await db.query(`select sesion_id from dolor_registros where atleta_id = $1 and zona = 'cadera'`, [id.berta])).rows[0]?.sesion_id === null, 'sin la sesión, la molestia se queda (sin ella)');
await db.query('delete from atletas where id = $1', [id.berta]);
check(Number((await db.query('select count(*) n from dolor_registros where atleta_id = $1', [id.berta])).rows[0].n) === 0, 'sin el atleta, sin rastro');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
