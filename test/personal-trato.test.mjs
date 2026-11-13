// Que la app le hable a cada uno, en la base: la migración 066 en un Postgres local (PGlite). Cómo le hablamos (género y
// tono), su meta con fecha y los dos momentos nuevos de los mensajes del coach.
//   node test/personal-trato.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 066 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
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
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const [{ d: hoy }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const mas = (n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

await como(ana);
await q(`select personal_guardar('{"apodo": "Anita", "porque": "Por mi espalda"}'::jsonb)`);
let [{ p }] = await q(`select personal_ajustes_guardar('{"genero": "f", "tono": "tope"}'::jsonb) as p`);
check(p.genero === 'f' && p.tono === 'tope' && p.apodo === 'Anita' && p.porque === 'Por mi espalda', 'guarda cómo le hablamos sin tocar lo de la 050');
[{ p }] = await q(`select personal_ajustes_guardar($1::jsonb) as p`, [JSON.stringify({ meta_nombre: '  Mi primera   competición ', meta_fecha: mas(60), meta_cifra: 100, meta_unidad: 'kg' })]);
check(p.meta_nombre === 'Mi primera competición' && p.meta_fecha === mas(60) && Number(p.meta_cifra) === 100 && p.meta_unidad === 'kg' && p.genero === 'f', 'su meta con fecha y cifra (lo demás se queda)');
[{ p }] = await q(`select personal_guardar('{"apodo": "Ana"}'::jsonb) as p`);
check(p.genero === 'f' && p.meta_nombre === 'Mi primera competición', 'y guardar lo de la 050 no borra lo nuevo');
check(await falla(`select personal_ajustes_guardar('{"genero": "x"}'::jsonb)`) && await falla(`select personal_ajustes_guardar('{"tono": "borde"}'::jsonb)`), 'solo los géneros y tonos que hay');
check(await falla(`select personal_ajustes_guardar($1::jsonb)`, [JSON.stringify({ meta_nombre: 'x', meta_fecha: mas(-1) })]) && await falla(`select personal_ajustes_guardar($1::jsonb)`, [JSON.stringify({ meta_nombre: 'x', meta_fecha: mas(800) })]),
  'la fecha de la meta, de hoy a dos años');
check(await falla(`select personal_ajustes_guardar($1::jsonb)`, [JSON.stringify({ meta_nombre: 'x', meta_cifra: 10 })]) && await falla(`select personal_ajustes_guardar($1::jsonb)`, [JSON.stringify({ meta_nombre: 'x', meta_cifra: 10, meta_unidad: 'litros' })])
  && await falla(`select personal_ajustes_guardar($1::jsonb)`, [JSON.stringify({ meta_nombre: 'x'.repeat(61) })]), 'la cifra, con su unidad; el nombre, hasta 60');
[{ p }] = await q(`select personal_ajustes_guardar('{"meta_nombre": ""}'::jsonb) as p`);
check(p.meta_nombre === null && p.meta_fecha === null && p.meta_cifra === null && p.tono === 'tope', 'sin nombre, la meta se quita entera');
await q(`select personal_ajustes_guardar('{"genero": null}'::jsonb)`);
check((await q('select personal_mio() as p'))[0].p.genero === null, 'y el trato se puede dejar sin elegir');
check(await falla(`update personal_atleta set genero = 'f'`) || (await q('select genero from personal_atleta'))[0]?.genero === null, 'a mano, no');
await su();
check(await falla(`update personal_atleta set genero = 'x'`) && await falla(`update personal_atleta set meta_cifra = 5, meta_unidad = null`), 'las reglas de la tabla lo impiden');
await como(coach, 'aal2');
check(await falla(`select personal_ajustes_guardar('{"tono": "directo"}'::jsonb)`), 'el coach no guarda por él');
const [{ l }] = await q('select personal_atletas() as l');
check(l[0].tono === 'tope' && 'genero' in l[0] && 'meta_nombre' in l[0], 'el coach ve cómo le hablamos y su meta');
await q(`select mensaje_coach_guardar('aniversario', 'Un año ya, {nombre}')`);
await q(`select mensaje_coach_guardar('meta', 'A por tu meta, {nombre}')`);
check((await q('select mensajes_coach() as m'))[0].m.length === 2 || JSON.stringify((await q('select mensajes_coach() as m'))[0].m).includes('aniversario'), 'dos momentos más para sus mensajes: aniversario y meta');
check(await falla(`select mensaje_coach_guardar('otro', 'x')`), 'los demás momentos, no');
await su();
await q('update atletas set estado = $2 where id = $1', [atletaA, 'baja']);
await como(ana);
check(await falla(`select personal_ajustes_guardar('{"tono": "directo"}'::jsonb)`), 'de baja, no cambia nada');
await su();
check((await q('select count(*)::int as n from fbe_migraciones where numero = 66'))[0].n === 1, 'la 066 queda apuntada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
