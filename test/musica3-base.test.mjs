// Música 3, en la base: la migración 072 en un Postgres local (PGlite). Sus listas con etiqueta y sus himnos, la música
// de cada sesión y lo que más abre, la música del coach (claves nuevas, biblioteca, qué funciona, copiarla), y con el
// equipo (lo que suena, el reto musical y la lista de los compañeros de racha).
//   node test/musica3-base.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 072 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const uno = async (sql, params = []) => Object.values((await q(sql, params))[0] || {})[0];
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test'), luis = await usuario('l@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const atletaL = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [luis]))[0].id;
const bloque = async (atleta) => (await q(`insert into public.bloques (atleta_id, numero, nombre, estado) values ($1, 1, 'B', 'planificado') returning id`, [atleta]))[0].id;
const semana = async (b) => (await q(`insert into public.semanas (bloque_id, numero, programacion) values ($1, 1, 'en_programacion') returning id`, [b]))[0].id;
const sesion = async (s, orden = 1) => (await q(`insert into public.sesiones (semana_id, orden, nombre) values ($1, $2, 'S') returning id`, [s, orden]))[0].id;
await su();
const bA = await bloque(atletaA), sA = await semana(bA), s1 = await sesion(sA, 1), s2 = await sesion(sA, 2);
const bL = await bloque(atletaL), sL = await semana(bL), sl1 = await sesion(sL, 1);
const SP = 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP', TR = 'https://open.spotify.com/track/2HHtWyy5CgaQbC7XSoOb0e', AM = 'https://music.apple.com/es/playlist/x/pl.1';

console.log('\n1. Sus listas con etiqueta y sus himnos');
await como(ana);
const g = await uno('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ musica_listas: [{ url: SP, etiqueta: 'pierna' }, { url: AM, etiqueta: 'energia' }], himno_ultima_url: TR })]);
check(g.musica_listas.length === 2 && g.himno_ultima_url === TR && g.himno_vuelta_url === null, 'guarda sus listas con etiqueta y su himno de la última serie');
const mio = await uno('select personal_mio()');
check(mio.musica_listas[0].etiqueta === 'pierna' && mio.himno_ultima_url === TR, 'y salen en lo suyo (personal_mio)');
await uno('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ himno_vuelta_url: SP })]);
check((await uno('select personal_mio()')).musica_listas.length === 2, 'guardar un himno no toca sus listas');
check(await falla('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ musica_listas: [{ url: 'https://ejemplo.com/x', etiqueta: 'pierna' }] })])
  && await falla('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ musica_listas: [{ url: SP, etiqueta: 'otra' }] })])
  && await falla('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ musica_listas: Array.from({ length: 13 }, () => ({ url: SP, etiqueta: 'core' })) })])
  && await falla('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ himno_ultima_url: 'javascript:alert(1)' })]), 'enlaces de otros sitios, etiquetas raras o más de 12 listas, no');
await como(coach);
check(await falla('select personal_musica_guardar($1::jsonb)', [JSON.stringify({ himno_vuelta_url: SP })]), 'el coach no guarda lo del atleta');
const deCoach = await uno('select personal_atletas()');
check(JSON.stringify(deCoach).includes(TR), 'el coach ve sus himnos y sus listas');

console.log('\n2. La música de cada sesión y lo que más abre');
await como(ana);
await q('select musica_abierta_lista($1, $2)', [SP, s1]);
await q('select musica_abierta_lista($1, $2)', [SP, s1]);
await q('select musica_abierta_lista($1, $2)', [TR, s2]);
await q('select musica_abierta_lista($1, $2)', [AM, sl1]);   // una sesión que no es suya
await q('select musica_abierta_lista($1, null)', ['https://ejemplo.com/x']); // no es música
const deS = await uno('select musica_de_sesiones($1::uuid[])', [[s1, s2, sl1]]);
check(deS[s1] === SP && deS[s2] === TR && !deS[sl1], 'cada sesión suya, con la última música que abrió (en la de otro, nada)');
const [{ m: mes }] = await q(`select to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM') as m`);
const mas = await uno('select musica_mas_abierta($1, $1)', [mes]);
check(mas[0].url === SP && mas[0].n === 2 && mas.length === 3 && !mas.some((x) => /ejemplo/.test(x.url)), 'lo que más abre este mes (la de la sesión ajena se cuenta en su mes, lo que no es música, no)');
await como(luis);
check(Object.keys(await uno('select musica_de_sesiones($1::uuid[])', [[s1, s2]])).length === 0 && (await uno('select musica_mas_abierta($1, $1, $2)', [mes, atletaA])).length === 0, 'otro atleta no ve la música de Ana');
check(await falla('select * from musica_sesion') && await falla('select * from musica_aperturas_lista'), 'las tablas no se leen directamente');
await su();
await q(`update public.atletas set estado = 'baja' where id = $1`, [atletaL]);
await como(luis);
await q('select musica_abierta_lista($1, $2)', [SP, sl1]);
await su();
check(Number(await uno('select count(*) from musica_aperturas_lista where atleta_id = $1', [atletaL])) === 0, 'de baja, no se cuenta');

console.log('\n3. La música del coach');
await como(coach);
for (const k of ['fase:calentamiento', 'fase:vuelta_calma', 'test', 'podcast']) await q('select musica_coach_guardar($1, $2)', [k, SP]);
const lista = await uno('select musica_coach_lista()');
check(['fase:calentamiento', 'fase:vuelta_calma', 'test', 'podcast'].every((k) => lista[k] === SP), 'las claves nuevas: fases, test y pódcast');
check(await falla(`select musica_coach_guardar('fase:otra', $1)`, [SP]) && await falla(`select musica_coach_guardar('test', 'https://malo.example/x')`), 'una clave rara o un enlace que no es de música, no');
await como(ana);
const para = await uno('select musica_para($1, $2)', [s1, bA]);
check(para.test === SP && para.podcast === SP && para['fase:calentamiento'] === SP, 'el atleta las recibe con lo general');
await como(coach);
await q('select musica_coach_guardar($1, $2)', [`bloque:${bA}`, SP]);
await q('select musica_coach_guardar($1, $2)', [`sesion:${s1}`, TR]);
await su();
const bN = await bloque(atletaL), sN = await semana(bN), sn1 = await sesion(sN, 1);
await como(coach);
const copiadas = await uno('select musica_copiar($1::jsonb, $2, $3)', [JSON.stringify([[s1, sn1], [s2, sn1], ['x', 'y']]), bA, bN]);
const tras = await uno('select musica_coach_lista()');
check(copiadas === 2 && tras[`bloque:${bN}`] === SP && tras[`sesion:${sn1}`] === TR, 'la música del bloque y de su sesión viaja al copiarlos (lo que no tiene, nada)');
await como(ana);
check(await falla('select musica_copiar($1::jsonb, $2, $3)', ['[]', bA, bN]), 'copiar música es del coach');
await como(coach);
const idB = await uno('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: SP, etiquetas: ['Pierna', ' energía ', 'pierna'], energia: 3, bpm: 128, minutos: 60, genero: 'Rock' })]);
const idB2 = await uno('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: SP, etiquetas: ['calma'], energia: 1 })]);
const bib = await uno('select musica_biblioteca()');
check(idB === idB2 && bib.length === 1 && bib[0].etiquetas.join() === 'calma' && bib[0].energia === 1, 'la biblioteca: un enlace, una ficha (al repetirlo, se actualiza)');
await uno('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ id: idB, url: AM, etiquetas: ['Pierna', ' energía ', 'pierna'], bpm: 128 })]);
check((await uno('select musica_biblioteca()'))[0].etiquetas.sort().join() === 'energía,pierna', 'las etiquetas, limpias y sin repetir');
check(await falla('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: SP, bpm: 400 })]) && await falla('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: SP, energia: 'mucha' })])
  && await falla('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: 'https://ejemplo.com' })]), 'bpm imposibles, energía que no es número o enlaces de otro sitio, no');
await como(ana);
check(await falla('select musica_biblioteca()') && await falla('select musica_biblioteca_guardar($1::jsonb)', [JSON.stringify({ url: SP })]), 'la biblioteca es solo del coach');
const PROPIA = 'https://music.youtube.com/playlist?list=PLsoloDeAna';
await como(ana);
await q('select musica_abierta_lista($1, null)', [PROPIA]);
await como(coach);
const uso = await uno('select musica_coach_uso($1)', [mes]);
check(uso.listas.some((x) => x.url === SP && x.n === 2 && x.atletas === 1) && !uso.listas.some((x) => x.url === PROPIA), 'qué música funciona: solo sus listas (las del atleta, no)');
check(uso.sesiones === 0 && uso.con_musica === 0, 'y las sesiones hechas del equipo con música (aquí, ninguna hecha)');
await como(ana);
check(await falla('select musica_coach_uso($1)', [mes]), 'eso lo ve solo el coach');

console.log('\n4. Con el equipo');
await su();
// (revisión) dentro de verdad: la comunidad abierta y con el texto y las normas vigentes
await q('update public.comunidad_ajustes set activa = true');
const miembro = async (perfil, atleta, nombre) => q(`insert into public.comunidad_miembros (atleta_id, perfil_id, nombre, version, normas_version, normas_leidas_en) values ($1, $2, $3, public.comunidad_version(), public.comunidad_normas_version(), now())`, [atleta, perfil, nombre]);
await q(`update public.atletas set estado = 'activo' where id = $1`, [atletaL]);
await miembro(ana, atletaA, 'Ana L.');
await miembro(luis, atletaL, 'Luis M.');
const ines = await usuario('i@x.test');
const atletaI = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Inés', $1, 'activo') returning id`, [ines]))[0].id;
await como(ana);
await q('select comunidad_cancion_guardar($1)', [TR]);
check((await uno('select comunidad_canciones()'))[0].url === TR, 'comparte su canción en «Lo que suena»');
await su(); await q('update public.comunidad_ajustes set activa = false'); await como(ana);
check((await uno('select comunidad_canciones()')).length === 0 && await falla('select comunidad_cancion_guardar($1)', [TR]), '(revisión) con la comunidad cerrada, ni se ve ni se comparte');
await su(); await q('update public.comunidad_ajustes set activa = true'); await q(`update public.atletas set estado = 'baja' where id = $1`, [atletaA]); await como(luis);
check((await uno('select comunidad_canciones()')).length === 0, '(revisión) la de quien está de baja no sale');
await su(); await q(`update public.atletas set estado = 'activo' where id = $1`, [atletaA]); await como(ana);
await como(luis);
const vistas = await uno('select comunidad_canciones()');
check(vistas.length === 1 && vistas[0].nombre === 'Ana L.' && vistas[0].yo === false, 'los demás de dentro la ven, con su nombre de la comunidad');
await como(ines);
check((await uno('select comunidad_canciones()')).length === 0 && await falla('select comunidad_cancion_guardar($1)', [TR]), 'quien no está en la comunidad, ni la ve ni comparte');
await como(coach);
check((await uno('select comunidad_canciones()')).length === 1, 'el coach la ve');
await su();
await q(`update public.comunidad_miembros set silenciado_hasta = now() + interval '1 day' where perfil_id = $1`, [luis]);
await como(luis);
check(await falla('select comunidad_cancion_guardar($1)', [SP]), 'silenciado, no comparte');
await su();
await q(`update public.comunidad_miembros set silenciado_hasta = null where perfil_id = $1`, [luis]);
// el reto musical
await como(luis);
check(await uno('select comunidad_reto_musical()') === null && await falla('select comunidad_reto_cancion($1)', [SP]), 'sin reto este mes, ni reto ni propuestas');
await como(coach);
await q('select musica_reto_guardar($1, $2)', [mes, '  Los 80  ']);
check(await falla('select musica_reto_guardar($1, $2)', ['2026-13', 'X y']) && await falla('select musica_reto_guardar($1, $2)', [mes, 'ab']), 'el tema y el mes, con su forma');
await como(ana);
check(await falla('select musica_reto_guardar($1, $2)', [mes, 'Otro tema'])  , 'el tema lo pone el coach');
await q('select comunidad_reto_cancion($1)', [TR]);
await como(luis);
await q('select comunidad_reto_cancion($1)', [SP]);
await q('select comunidad_reto_votar($1)', [ana]);
check(await falla('select comunidad_reto_votar($1)', [luis]), 'a la suya no se vota');
let reto = await uno('select comunidad_reto_musical()');
check(reto.tema === 'Los 80' && reto.canciones.length === 2 && reto.canciones[0].nombre === 'Ana L.' && reto.canciones[0].votos === 1 && reto.mi_voto === ana, 'el reto: el tema, las propuestas con sus votos y su voto');
await q('select comunidad_reto_votar(null)');
check((await uno('select comunidad_reto_musical()')).canciones.every((x) => x.votos === 0), 'puede quitar su voto');
await q('select comunidad_reto_votar($1)', [ana]);
await como(ana);
await q('select comunidad_reto_cancion(null)');
reto = await uno('select comunidad_reto_musical()');
check(reto.canciones.length === 1 && reto.canciones[0].nombre === 'Luis M.', 'si quita la suya, sale del reto (y sus votos con ella)');
await su();
check(Number(await uno(`select count(*) from comunidad_miembros where reto_voto = $1`, [ana])) === 0, '(sus votos, borrados)');
// salir de la comunidad borra su canción, su propuesta y su voto
await como(luis);
await q('select comunidad_reto_cancion($1)', [SP]);
await q('select comunidad_cancion_guardar($1)', [AM]);
await q('select comunidad_salir(false)');
await su();
const fila = (await q('select cancion_url, reto_cancion_url, reto_voto from comunidad_miembros where perfil_id = $1', [luis]))[0];
check(fila.cancion_url === null && fila.reto_cancion_url === null && fila.reto_voto === null, 'al salir de la comunidad, su canción, su propuesta y su voto se borran');
// la lista de los compañeros de racha
await q(`update public.comunidad_miembros set salido_en = null where perfil_id = $1`, [luis]);
const par = (await q(`insert into public.comunidad_companeros (de, para, de_atleta_id, para_atleta_id, estado, aceptado_en) values ($1, $2, $3, $4, 'aceptada', now()) returning id`, [ana, luis, atletaA, atletaL]))[0].id;
await como(ana);
await q('select comunidad_companero_lista($1, $2)', [par, SP]);
await como(luis);
const ls = await uno('select comunidad_listas_companeros()');
check(ls.length === 1 && ls[0].url === SP && ls[0].otro === 'Ana L.', 'su compañero de racha ve la lista que comparten');
await como(ines);
check((await uno('select comunidad_listas_companeros()')).length === 0 && await falla('select comunidad_companero_lista($1, $2)', [par, AM]), 'nadie más la ve ni la cambia');
await como(luis);
check(await falla('select comunidad_companero_lista($1, $2)', [par, 'https://ejemplo.com']), 'solo enlaces de música');

console.log('\n5. La copia del coach y los permisos');
await como(coach);
const copia = await uno('select copia_privada()');
check(['musica_sesion', 'musica_aperturas_lista', 'musica_biblioteca', 'musica_retos'].every((k) => Array.isArray(copia[k])) && copia.musica_sesion.length === 2, 'la copia completa lleva las tablas nuevas');
await su();
const anonimo = await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('personal_musica_guardar', 'musica_abierta_lista', 'musica_de_sesiones', 'musica_mas_abierta', 'musica_copiar', 'musica_biblioteca', 'musica_biblioteca_guardar', 'musica_biblioteca_borrar', 'musica_coach_uso', 'comunidad_cancion_guardar', 'comunidad_canciones', 'musica_reto_guardar', 'comunidad_reto_musical', 'comunidad_reto_cancion', 'comunidad_reto_votar', 'comunidad_listas_companeros', 'comunidad_companero_lista')
  and has_function_privilege('anon', p.oid, 'execute')`);
check(anonimo.length === 0, 'sin sesión no se puede llamar a ninguna');
const privadas = await q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'fbe_privado'
  and p.proname in ('musica_url_valida', 'musica_mes', 'comunidad_musica_al_salir', 'comunidad_puede_musica', 'comunidad_ve_musica') and has_function_privilege('authenticated', p.oid, 'execute')`);
check(privadas.length === 0, 'las de dentro (fbe_privado), cerradas');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
