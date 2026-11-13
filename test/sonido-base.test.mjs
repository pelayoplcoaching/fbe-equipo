// Las frases del coach, con su voz (migración 064), en un Postgres local (PGlite) y en la demo: solo el coach las graba
// y las quita, las leen él y los atletas, y sus audios van en su bucket privado. Uso: node test/sonido-base.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

// ------------------------------------------------------------ en la demo (backend en memoria): lo mismo que la base
console.log('En la demo');
{
  const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
  const { crearApi } = await import('../web/src/datos/api.js');
  const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const api = crearApi(b);
  const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
  const audio = (n = 4000) => new Blob([new Uint8Array(n)], { type: 'audio/webm' });
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await api.vocesCoach()).length === 0, 'al principio, sin frases');
  const r1 = await api.guardarVozCoach('vamos', audio(), 900);
  const r2 = await api.guardarVozCoach('vamos', audio(), 1100);
  const lista = await api.vocesCoach();
  check(lista.length === 1 && lista[0].ruta === r2 && lista[0].duracion_ms === 1100 && r1 !== r2, 'el coach graba «¡Vamos!» y, al volver a grabarla, se queda la nueva');
  check(await lanza(() => api.urlVozCoach(r1)), 'el audio de antes se borra');
  check(await lanza(() => api.guardarVozCoach('vamos', new Blob([new Uint8Array(10)], { type: 'video/mp4' }))), 'solo audio');
  check(await lanza(() => api.guardarVozCoach('inventada', audio())), 'solo las frases que hay');
  await api.guardarVozCoach('record', audio(), 700);
  await b.auth.salir();
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const desdeAna = await api.vocesCoach();
  check(desdeAna.length === 2 && typeof (await api.urlVozCoach(r2)) === 'string', 'un atleta las ve y descarga sus audios');
  check(await lanza(() => api.guardarVozCoach('vamos', audio())) && await lanza(() => api.quitarVozCoach('vamos')), 'un atleta no graba ni quita frases');
  check(await lanza(() => b.insert('voces_coach', [{ clave: 'ultima', ruta: 'voces/ultima-12345678.webm' }])), 'nadie escribe la tabla a mano');
  await b.auth.salir();
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.quitarVozCoach('record');
  check((await api.vocesCoach()).length === 1, 'el coach quita una frase');
  // (065) las cuatro frases nuevas
  for (const k of ['saludo', 'mitad_sesion', 'a_por_record', 'ultimo_ejercicio']) await api.guardarVozCoach(k, audio(), 800);
  check((await api.vocesCoach()).length === 5, '(065) el coach graba también el saludo, la mitad, «a por el récord» y el último ejercicio');
  await b.auth.salir();
}

const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones (con la 064 y la 065) aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const anon = async (sql) => { await db.exec(`reset role; ${claims('', '')} set role anon;`); return falla(sql); };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };

const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test'); await su(); await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo')`, [ana]);
const suelto = await usuario('s@x.test');
const R1 = 'voces/vamos-0123abcd-aaaa.webm', R2 = 'voces/vamos-0123abcd-bbbb.webm';

console.log('\nLas frases');
{
  await como(coach, 'aal2');
  check((await q('select voces_coach_guardar($1, $2, 900) as r', ['vamos', R1]))[0].r === null, 'el coach guarda una frase');
  check((await q('select voces_coach_guardar($1, $2, 99999) as r', ['vamos', R2]))[0].r === R1 && (await q('select duracion_ms from voces_coach'))[0].duracion_ms === 8000, 'al cambiarla devuelve el audio de antes (para borrarlo) y la duración tiene tope');
  check(await falla(`select voces_coach_guardar('inventada', 'voces/inventada-0123abcd.webm')`) && await falla(`select voces_coach_guardar('ultima', '../otro/sitio.webm')`), 'solo las frases que hay, con su ruta en su carpeta');
  await como(ana);
  check((await q('select * from voces_coach')).length === 1, 'el atleta la ve');
  check(await falla(`select voces_coach_guardar('ultima', 'voces/ultima-0123abcd.webm')`) && await falla(`insert into voces_coach (clave, ruta) values ('ultima', 'voces/ultima-0123abcd.webm')`) && await falla(`select voces_coach_quitar('vamos')`), 'el atleta no la escribe (ni a mano ni con las funciones)');
  await como(suelto);
  check((await q('select * from voces_coach')).length === 0, 'sin ficha de atleta, nada');
  check(await anon('select * from voces_coach') && await anon(`select voces_coach_quitar('vamos')`), 'sin sesión, nada');
  await como(coach, 'aal2');
  check((await q(`select voces_coach_quitar('vamos') as r`))[0].r === R2 && (await q('select count(*)::int as n from voces_coach'))[0].n === 0, 'el coach la quita (y le dice qué audio borrar)');
}

console.log('\nEl bucket «voces-coach»');
{
  await su();
  const [bk] = await q(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'voces-coach'`);
  check(bk && bk.public === false && Number(bk.file_size_limit) === 2097152 && bk.allowed_mime_types.every((m) => m.startsWith('audio/')), 'privado, 2 MB y solo audio');
  await como(coach, 'aal2');
  check(!(await falla(`insert into storage.objects (bucket_id, name) values ('voces-coach', $1)`, [R1])), 'el coach sube a él');
  await como(ana);
  check(await falla(`insert into storage.objects (bucket_id, name) values ('voces-coach', 'voces/ultima-0123abcd.webm')`), 'el atleta no sube');
  check((await q(`select name from storage.objects where bucket_id = 'voces-coach'`)).length === 1, 'pero sí descarga');
  check(await falla(`delete from storage.objects where bucket_id = 'voces-coach' returning 1`).then(async (f) => f || (await q(`select count(*)::int as n from storage.objects where bucket_id = 'voces-coach'`))[0].n === 1), 'ni borra');
  await como(suelto);
  check((await q(`select name from storage.objects where bucket_id = 'voces-coach'`)).length === 0, 'sin ficha de atleta, no lo ve');
  await su();
  check((await q(`select count(*)::int as n from fbe_migraciones where numero = 64`))[0].n === 1, 'la 064 queda apuntada');
}

console.log('\nLas cuatro frases nuevas (065)');
{
  await como(coach, 'aal2');
  let todas = true;
  for (const k of ['saludo', 'mitad_sesion', 'a_por_record', 'ultimo_ejercicio']) todas = todas && (await q('select voces_coach_guardar($1, $2, 700) as r', [k, `voces/${k}-0123abcd-cccc.webm`]))[0].r === null;
  check(todas && (await q('select count(*)::int as n from voces_coach'))[0].n === 4, 'el coach guarda el saludo, la mitad, «a por el récord» y el último ejercicio');
  check(await falla(`select voces_coach_guardar('otra_mas', 'voces/otra_mas-0123abcd.webm')`), 'y sigue sin admitir frases que no hay');
  await su();
  check((await q(`select count(*)::int as n from fbe_migraciones where numero = 65`))[0].n === 1, 'la 065 queda apuntada');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
