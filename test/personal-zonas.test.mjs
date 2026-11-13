// Que la app le conozca, en la base: la migración 067 en un Postgres local (PGlite). Los momentos nuevos de los mensajes
// del coach: los avisos por zona ('molestia_<zona>'), la primera vez y la vuelta de un viaje.
//   node test/personal-zonas.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 067 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const { MOMENTO_VALIDO } = await import('../web/src/logica/personal.js');
const { ZONAS_AVISO, momentoZona } = await import('../web/src/logica/conocerte.js');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test');
await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo')`, [ana]);

await como(coach, 'aal2');
for (const z of ZONAS_AVISO) await q('select mensaje_coach_guardar($1, $2)', [momentoZona(z), `Texto de ${z}`]);
await q(`select mensaje_coach_guardar('primera_vez', 'Primera vez, {nombre}')`);
await q(`select mensaje_coach_guardar('viaje', 'Bienvenida de vuelta, {nombre}')`);
await q(`select mensaje_coach_guardar('meta', 'A por tu meta')`);
const lista = (await q('select mensajes_coach() as m'))[0].m;
check(ZONAS_AVISO.every((z) => lista.some((m) => m.momento === momentoZona(z))), `el coach guarda un aviso por zona (${ZONAS_AVISO.length} zonas)`);
check(lista.some((m) => m.momento === 'primera_vez') && lista.some((m) => m.momento === 'viaje') && lista.some((m) => m.momento === 'meta'), 'y los de la primera vez y la vuelta de un viaje (los de la 066 siguen)');
check(await falla(`select mensaje_coach_guardar('molestia_otra', 'x')`) && await falla(`select mensaje_coach_guardar('molestia_', 'x')`), 'una zona que no está, no');
await q(`select mensaje_coach_guardar('molestia_hombro', '')`);
check(!(await q('select mensajes_coach() as m'))[0].m.some((m) => m.momento === 'molestia_hombro'), 'vacío, el aviso se quita');
await como(ana);
check(await falla(`select mensaje_coach_guardar('molestia_rodilla', 'x')`), 'el atleta no los escribe');
check((await q('select mensajes_coach() as m'))[0].m.some((m) => m.momento === 'molestia_rodilla'), 'pero los lee (para su aviso)');
// la app y la base, de acuerdo en los momentos
check(ZONAS_AVISO.every((z) => MOMENTO_VALIDO.has(momentoZona(z))), 'la app acepta los mismos avisos por zona');
await su();
check((await q('select count(*)::int as n from fbe_migraciones where numero = 67'))[0].n === 1, 'la 067 queda apuntada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
