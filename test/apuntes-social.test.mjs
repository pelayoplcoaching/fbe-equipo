// Apuntes con los demás, en la base: la migración 065 en un Postgres local (PGlite). Los puntos de cada semana y la liga
// (con las reglas de la clasificación de la comunidad), los duelos de cinco preguntas, el audio del coach y lo que ve el
// coach del equipo (solo cuentas).
//   node test/apuntes-social.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La migración 065 (PGlite)');
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
const gente = {};
for (const n of ['ana', 'bea', 'cris', 'dani', 'eva']) {
  const u = await usuario(`${n}@x.test`);
  const a = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ($1, $2, 'activo') returning id`, [n, u]))[0].id;
  gente[n] = { u, a };
}
const [{ l: lunes }] = await q(`select ((now() at time zone 'Europe/Madrid')::date - (extract(isodow from (now() at time zone 'Europe/Madrid')::date)::integer - 1))::text as l`);
const restar = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };

console.log('Los puntos de la semana');
await como(gente.ana.u);
await q('select apuntes_semana_sumar($1::date, 120, 14)', [lunes]);
await q('select apuntes_semana_sumar($1::date, 90, 20)', [lunes]);
const [s] = await q('select puntos, apuntes from apuntes_semanas');
check(s.puntos === 120 && s.apuntes === 20, 'se queda el mayor de cada cifra (lo manda la app, puede repetirse)');
check(await falla('select apuntes_semana_sumar($1::date, 10, 1)', [restar(lunes, 14)]) && await falla('select apuntes_semana_sumar($1::date, 10, 1)', [restar(lunes, 1)]), 'solo esta semana o la pasada (y en lunes)');
check(!(await falla('select apuntes_semana_sumar($1::date, 10, 1)', [restar(lunes, 7)])), 'la pasada sí (si se quedó sin subir)');
check(await falla('select apuntes_semana_sumar($1::date, 20001, 1)', [lunes]) && await falla('select apuntes_semana_sumar($1::date, -1, 1)', [lunes]), 'cifras razonables');
check(await falla(`insert into apuntes_semanas (atleta_id, semana, puntos) values ($1, $2::date, 999)`, [gente.ana.a, lunes]) && await falla(`update apuntes_semanas set puntos = 9999`), 'a mano, no (solo con la función)');
await como(gente.bea.u);
check((await q('select * from apuntes_semanas')).length === 0, 'otro atleta no ve lo de Ana');
await como(coach, 'aal2');
check(await falla('select apuntes_semana_sumar($1::date, 1, 1)', [lunes]), 'el coach no suma');

console.log('La liga');
await su();
const [{ v: version }] = await q('select public.comunidad_version() as v'); const [{ v: normas }] = await q('select public.comunidad_normas_version() as v');
await como(coach, 'aal2'); await q('update comunidad_ajustes set activa = true');
for (const [n, nombre] of [['ana', 'Ana L.'], ['bea', 'Bea M.'], ['cris', 'Cris R.'], ['dani', 'Dani P.']]) { await como(gente[n].u); await q('select comunidad_unirme($1, $2, $3)', [nombre, version, normas]); }
for (const [n, p] of [['bea', 300], ['cris', 50], ['dani', 75], ['eva', 999]]) { await como(gente[n].u); await q('select apuntes_semana_sumar($1::date, $2, 5)', [lunes, p]); }
await su(); await q('update comunidad_miembros set sin_ranking = true where perfil_id = $1', [gente.cris.u]);
await como(gente.ana.u);
const [{ l: liga }] = await q('select apuntes_liga() as l');
check(liga.semana === lunes && liga.filas.map((f) => f.nombre).join() === 'Bea M.,Ana L.,Dani P.' && liga.filas.find((f) => f.yo).nombre === 'Ana L.',
  'la liga: los de la comunidad por puntos, con el nombre de allí; quien no quiere salir no sale; quien no está en la comunidad (Eva), tampoco');
check(liga.gente.map((g) => g.nombre).join() === 'Bea M.,Dani P.' && liga.gente.every((g) => g.id), 'la gente a la que retar: dentro y en el ranking, sin mí');
check(liga.equipo.puntos === 120 + 300 + 75 && liga.equipo.miembros === 3, 'el total del equipo sin lo de quien no sale (con menos de tres así, se sabría lo suyo)');
await como(gente.cris.u);
const [{ l: ligaC }] = await q('select apuntes_liga() as l');
check(ligaC.filas.some((f) => f.yo && f.nombre === 'Cris R.') && ligaC.gente.length === 0, 'quien no sale se ve a sí mismo, y no reta');
await como(gente.eva.u);
check((await q('select apuntes_liga() as l'))[0].l === null, 'fuera de la comunidad, nada');
await como(coach, 'aal2');
check((await q('select apuntes_liga() as l'))[0].l.filas.length === 3, 'el coach ve la liga (sin los que no quieren salir)');

console.log('Los duelos');
await su(); await q('delete from notificaciones'); await q(`insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [gente.bea.u]);
await como(gente.ana.u);
const [{ id: d1 }] = await q('select apuntes_duelo_retar($1, 12345) as id', [gente.bea.u]);
check(!!d1, 'Ana reta a Bea');
await su();
const [aviso] = await q('select tipo, titulo, url from notificaciones where usuario_id = $1', [gente.bea.u]);
check(aviso?.tipo === 'comunidad' && aviso.titulo === 'Ana L. te reta a un duelo de apuntes' && aviso.url === '#semana', 'a Bea le llega el aviso (con el nombre de la comunidad)');
await como(gente.ana.u);
check(await falla('select apuntes_duelo_retar($1, 1)', [gente.bea.u]), 'uno vivo entre los mismos dos');
check(await falla('select apuntes_duelo_retar($1, 1)', [gente.cris.u]) && await falla('select apuntes_duelo_retar($1, 1)', [gente.eva.u]) && await falla('select apuntes_duelo_retar($1, 1)', [gente.ana.u]),
  'no se reta a quien no sale en el ranking, a quien no está en la comunidad ni a uno mismo');
await q('select apuntes_duelo_contestar($1, 4::smallint)', [d1]);
check(await falla('select apuntes_duelo_contestar($1, 5::smallint)', [d1]), 'se contesta una vez');
let [m] = await q('select * from apuntes_duelos_mios()');
check(m.soy_retador && m.rival_nombre === 'Bea M.' && m.semilla === 12345 && m.mios === 4 && m.suyos === null && !m.rival_contesto && !m.acabado, 'Ana ve su duelo: sus aciertos; los de Bea, aún no');
await como(gente.bea.u);
[m] = await q('select * from apuntes_duelos_mios()');
check(!m.soy_retador && m.rival_nombre === 'Ana L.' && m.mios === null && m.suyos === null && m.rival_contesto, 'Bea no ve los aciertos de Ana hasta contestar (sí que ya contestó)');
await q('select apuntes_duelo_contestar($1, 3::smallint)', [d1]);
[m] = await q('select * from apuntes_duelos_mios()');
check(m.mios === 3 && m.suyos === 4 && m.acabado, 'al contestar, los dos resultados');
check(await falla('select apuntes_duelo_contestar($1, 9::smallint)', [d1]), 'de 0 a 5');
await como(gente.dani.u);
check((await q('select * from apuntes_duelos_mios()')).length === 0 && (await q('select * from apuntes_duelos')).length === 0 && await falla('select apuntes_duelo_contestar($1, 1::smallint)', [d1]), 'los demás ni lo ven ni lo tocan');
check(await falla(`insert into apuntes_duelos (de, para, semilla, caduca) values ($1, $2, 1, now()::date)`, [gente.dani.u, gente.ana.u]), 'a mano, no');
await como(gente.ana.u);
await q('select apuntes_duelo_retar($1, 2)', [gente.dani.u]);
await su(); await q(`update apuntes_duelos set caduca = (now() at time zone 'Europe/Madrid')::date - 1 where para = $1`, [gente.dani.u]);
await como(gente.dani.u);
check(await falla(`select apuntes_duelo_contestar((select id from apuntes_duelos_mios() limit 1), 2::smallint)`) && (await q('select acabado from apuntes_duelos_mios()'))[0].acabado, 'caducado (una semana), ya no se contesta y cuenta como acabado');

console.log('Las audio-píldoras');
await como(coach, 'aal2');
const ruta = 'audio/11111111-2222-3333-4444-555555555555.webm';
const [nv] = await q(`insert into novedades (titulo, texto, publicada, audio_ruta, audio_segundos) values ('Escúchame', 'Un minuto sobre el descanso.', true, $1, 62) returning id`, [ruta]);
check(!!nv.id, 'el coach pone un audio en una novedad (ruta y segundos)');
check(await falla(`insert into novedades (titulo, texto, audio_ruta, audio_segundos) values ('x', 'y', 'otra/cosa.webm', 10)`)
  && await falla(`insert into novedades (titulo, texto, audio_ruta, audio_segundos) values ('x', 'y', $1, 301)`, [ruta.replace('1111', '9999')])
  && await falla(`insert into novedades (titulo, texto, audio_ruta) values ('x', 'y', $1)`, [ruta.replace('1111', '8888')]), 'la ruta, en su carpeta; hasta cinco minutos; con sus segundos');
await como(gente.ana.u);
check((await q('select audio_de_apunte($1) as s', [ruta]))[0].s === true && (await q(`select audio_de_apunte('audio/otro.webm') as s`))[0].s === false, 'el atleta oye el de una novedad publicada; otro, no');
await como(coach, 'aal2');
await q(`update novedades set audio_ruta = null, audio_segundos = null where id = $1`, [nv.id]);
await su();
check((await q(`select bucket from fbe_privado.storage_por_borrar where ruta = $1`, [ruta]))[0]?.bucket === 'apuntes', 'al quitar el audio, el archivo va a la cola de Storage');
check((await q(`select public, file_size_limit from storage.buckets where id = 'apuntes'`))[0]?.public === false, 'en un bucket privado');

console.log('El dominio del equipo');
for (const [n, caja] of [['ana', 4], ['bea', 1], ['dani', 3]]) { await como(gente[n].u); await q(`select apuntar_apunte(p_apunte => 'g:rir', p_sabia => true, p_caja => $1::smallint, p_proxima => (now() at time zone 'Europe/Madrid')::date + 3)`, [caja]); }
await como(coach, 'aal2');
const dom = await q('select * from apuntes_dominio_equipo()');
const rir = dom.find((x) => x.apunte === 'g:rir');
check(rir.atletas === 3 && Number(rir.caja_media) === 2.67 && rir.dominan === 2 && !Object.keys(rir).some((k) => /atleta_id|nombre/.test(k)), 'para el coach: cuántos lo han visto, su caja media y cuántos lo dominan (nunca quién)');
const part = await q('select semana::text as s, atletas, puntos, activos from apuntes_participacion()');
check(part.length === 6 && part[5].s === lunes && part[5].atletas === 5 && part[4].atletas === 1 && part[5].activos === 5, 'quién participa cada semana (las seis últimas), en cuentas');
await como(gente.ana.u);
check(await falla('select * from apuntes_dominio_equipo()') && await falla('select * from apuntes_participacion()'), 'solo el coach');
const anon = async (sql) => { await db.exec(`reset role; ${claims('', '')} set role anon;`); return falla(sql); };
check(await anon('select apuntes_liga()') && await anon('select * from apuntes_duelos_mios()') && await anon('select * from apuntes_semanas'), 'sin sesión, nada');
await su();
check((await q('select count(*)::int as n from fbe_migraciones where numero = 63'))[0].n === 1, 'la 065 queda apuntada');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
