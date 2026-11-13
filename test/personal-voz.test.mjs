// Que le acompañe más allá de la app, en la base: la migración 070 en un Postgres local (PGlite). La voz del coach en
// sus mensajes, el momento de bienvenida y el compañero afín.
//   node test/personal-voz.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 070 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const { MOMENTO_VALIDO } = await import('../web/src/logica/personal.js');
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
const gente = {};
for (const n of ['ana', 'bea', 'cris', 'dani']) {
  const u = await usuario(`${n}@x.test`);
  gente[n] = { u, a: (await q(`insert into public.atletas (nombre, perfil_id, estado) values ($1, $2, 'activo') returning id`, [n, u]))[0].id };
}
const ruta = 'voz/123e4567-e89b-12d3-a456-426614174000.webm';

// La voz del coach
await como(coach, 'aal2');
check(await falla(`select mensaje_coach_audio('record', $1, 20)`, [ruta]), 'sin texto, no hay audio (escribe antes el mensaje)');
await q(`select mensaje_coach_guardar('record', '¡Ese récord, {nombre}!')`);
await q(`select mensaje_coach_audio('record', $1, 20)`, [ruta]);
let m = (await q('select mensajes_coach() as m'))[0].m.find((x) => x.momento === 'record');
check(m.audio_ruta === ruta && m.audio_segundos === 20, 'el coach le pone su audio a un mensaje');
check(await falla(`select mensaje_coach_audio('record', 'otra/cosa.webm', 20)`) && await falla(`select mensaje_coach_audio('record', $1, 200)`, [ruta]), 'ruta de su carpeta y hasta 2 minutos');
await q(`select mensaje_coach_guardar('bienvenida', 'Bienvenido al equipo, {nombre}')`);
check((await q('select mensajes_coach() as m'))[0].m.some((x) => x.momento === 'bienvenida') && MOMENTO_VALIDO.has('bienvenida'), 'el momento de bienvenida (en la base y en la app)');
await como(gente.ana.u);
check((await q('select mensajes_coach() as m'))[0].m.find((x) => x.momento === 'record').audio_ruta === ruta, 'sus atletas lo ven (y lo pueden oír)');
check(await falla(`select mensaje_coach_audio('record', null, null)`), 'el atleta no lo toca');
check((await q('select public.audio_de_coach($1) as v', [ruta]))[0].v === true && (await q(`select public.audio_de_coach('voz/x.webm') as v`))[0].v === false, 'solo se oyen los audios de los mensajes');
await como(coach, 'aal2');
await q(`select mensaje_coach_audio('record', null, null)`);
await su();
check((await q(`select count(*)::int as n from fbe_privado.storage_por_borrar where ruta = $1 and bucket = 'coach-voz'`, [ruta]))[0].n === 1, 'al quitarlo, el archivo va a la cola de Storage');
check((await q(`select public from storage.buckets where id = 'coach-voz'`))[0]?.public === false, 'el bucket es privado');

// Compañero afín
const [{ v: version }] = await q('select public.comunidad_version() as v'); const [{ v: normas }] = await q('select public.comunidad_normas_version() as v');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
for (const [n, nombre] of [['ana', 'Ana L.'], ['bea', 'Bea M.'], ['cris', 'Cris R.']]) { await como(gente[n].u); await q('select comunidad_unirme($1, $2, $3)', [nombre, version, normas]); }
await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id = $1', [gente.cris.u]);
await como(gente.ana.u);
let r = (await q('select comunidad_afines() as r'))[0].r;
check(r.busca === false && r.afines.length === 0, 'sin buscar, no ve a nadie');
await q('select comunidad_busco_companero(true)');
await como(gente.bea.u); await q('select comunidad_busco_companero(true)');
await como(gente.cris.u);
check(await falla('select comunidad_busco_companero(true)'), 'quien no sale en el ranking no puede buscar');
await como(gente.ana.u);
r = (await q('select comunidad_afines() as r'))[0].r;
check(r.busca === true && r.afines.length === 2 && r.afines.some((x) => x.nombre === 'Bea M.' && !x.yo) && r.afines.some((x) => x.yo), 'buscando, ve a quien también busca (con su franja y sus días)');
check(!r.afines.some((x) => x.nombre === 'Cris R.'), 'y no a quien no sale en el ranking');
await como(gente.dani.u);
check((await q('select comunidad_afines() as r'))[0].r === null && await falla('select comunidad_busco_companero(true)'), 'fuera de la comunidad, nada');
await como(gente.ana.u); await q('select comunidad_busco_companero(false)');
check((await q('select comunidad_afines() as r'))[0].r.afines.length === 0, 'al dejar de buscar, deja de ver');
// (revisión) se apaga solo al pasar a «No salir en el ranking», y con la comunidad cerrada no hay nada
await como(gente.bea.u);
await q('select comunidad_ajustar(null, true)'); await q('select comunidad_ajustar(null, false)');
await su();
check((await q(`select busca_companero from comunidad_miembros where nombre = 'Bea M.'`))[0].busca_companero === false, '(revisión) al pasar a «No salir en el ranking», deja de buscar (y no vuelve solo)');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = false');
await como(gente.ana.u);
check((await q('select comunidad_afines() as r'))[0].r === null && await falla('select comunidad_busco_companero(true)'), '(revisión) con la comunidad cerrada, nada');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
await su();
check((await q('select count(*)::int as n from fbe_migraciones where numero = 70'))[0].n === 1, 'la 070 queda apuntada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
