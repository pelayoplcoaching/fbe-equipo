// El perfil, tanda 4, en la base: la migración 073 en un Postgres local (PGlite). Lo que evita y su material, el rincón
// de ánimo (solo suyo) y la foto de portada (bucket «portadas»: quién la ve y su cola de borrado).
//   node test/perfil4-base.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 073 (PGlite)');
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
const ana = await usuario('a@x.test'), luis = await usuario('l@x.test'), eva = await usuario('e@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const atletaL = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [luis]))[0].id;
const atletaE = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Eva', $1, 'activo') returning id`, [eva]))[0].id;
const ej = async (n) => (await q(`insert into public.ejercicios (nombre, grupos_musculares) values ($1, '{pectoral}') returning id`, [n]))[0].id;
const e1 = await ej('Press banca'), e2 = await ej('Fondos');
const P = (x) => [JSON.stringify(x)];

console.log('\n1. Lo que evita y su material');
await como(ana);
let r = await uno('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [{ ejercicio_id: e1, motivo: 'molestia' }, { ejercicio_id: e2, motivo: 'gusto' }] }));
check(r.evitados.length === 2 && r.evitados[0].motivo === 'molestia' && JSON.stringify(r.material) === '{}', 'guarda los que evita, con su motivo');
r = await uno('select personal_perfil4_guardar($1::jsonb)', P({ material: { casa: ['mancuernas', 'gomas'], viaje: ['poleas'], mancuernas_kg: 22.5 } }));
check(r.evitados.length === 2 && r.material.mancuernas_kg === 22.5 && r.material.casa.length === 2, 'guardar el material no toca lo que evita');
check((await uno('select personal_mio()')).material.viaje[0] === 'poleas', 'y sale en lo suyo (personal_mio)');
check(await falla('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [{ ejercicio_id: e1, motivo: 'pereza' }] }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [{ ejercicio_id: '00000000-0000-0000-0000-000000000000', motivo: 'gusto' }] }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [{ ejercicio_id: e1, motivo: 'gusto' }, { ejercicio_id: e1, motivo: 'molestia' }] }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [{ ejercicio_id: e1, motivo: 'gusto', extra: 1 }] }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ apodo: 'X' })), 'motivos raros, ejercicios que no existen o repetidos, claves de más u otras cosas, no');
check(await falla('select personal_perfil4_guardar($1::jsonb)', P({ material: { casa: ['cohete'] } }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ material: { mancuernas_kg: 400 } }))
  && await falla('select personal_perfil4_guardar($1::jsonb)', P({ material: { gimnasio: [] } })), 'material que no está en la lista, mancuernas de 400 kg o sitios raros, no');
await como(coach);
check(await falla('select personal_perfil4_guardar($1::jsonb)', P({ evitados: [] })), 'el coach no guarda lo del atleta');
const deCoach = (await uno('select personal_atletas()')).find((x) => x.atleta_id === atletaA);
check(deCoach.evitados.length === 2 && deCoach.material.mancuernas_kg === 22.5, 'el coach ve lo que evita y su material');
await como(luis);
check(await falla('select personal_atletas()') && (await uno('select personal_mio()')) === null, 'otro atleta no lo ve');

console.log('\n2. El rincón de ánimo');
await su();
const msgCoach = (await q(`insert into public.comentarios (atleta_id, autor, texto) values ($1, 'coach', 'Eres más fuerte de lo que crees') returning id`, [atletaA]))[0].id;
const msgProgramado = (await q(`insert into public.comentarios (atleta_id, autor, texto, enviar_en) values ($1, 'coach', 'Para el lunes', now() + interval '2 days') returning id`, [atletaA]))[0].id;
const msgSuyo = (await q(`insert into public.comentarios (atleta_id, autor, texto) values ($1, 'atleta', 'Gracias') returning id`, [atletaA]))[0].id;
const msgOtro = (await q(`insert into public.comentarios (atleta_id, autor, texto) values ($1, 'coach', 'Para Luis') returning id`, [atletaL]))[0].id;
await q('update public.comunidad_ajustes set activa = true');
const miembro = async (perfil, atleta, nombre) => q(`insert into public.comunidad_miembros (atleta_id, perfil_id, nombre, version, normas_version, normas_leidas_en) values ($1, $2, $3, public.comunidad_version(), public.comunidad_normas_version(), now())`, [atleta, perfil, nombre]);
await miembro(ana, atletaA, 'Ana L.'); await miembro(luis, atletaL, 'Luis P.');
const postA = (await q(`insert into public.comunidad_posts (autor_id, atleta_id, texto) values ($1, $2, 'Primer récord') returning id`, [ana, atletaA]))[0].id;
const postL = (await q(`insert into public.comunidad_posts (autor_id, atleta_id, texto) values ($1, $2, 'Hoy pierna') returning id`, [luis, atletaL]))[0].id;
const cLuis = (await q(`insert into public.comunidad_comentarios (post_id, autor_id, atleta_id, texto) values ($1, $2, $3, '¡Enhorabuena!') returning id`, [postA, luis, atletaL]))[0].id;
const cEnOtro = (await q(`insert into public.comunidad_comentarios (post_id, autor_id, atleta_id, texto) values ($1, $2, $3, 'Vamos') returning id`, [postL, ana, atletaA]))[0].id;
await como(ana);
check(await uno('select animo_fijar($1, $2, true)', ['chat', msgCoach]) === true && await uno('select animo_fijar($1, $2, true)', ['comunidad', cLuis]) === true, 'fija un mensaje de su coach y un comentario de un compañero en su publicación');
const rincon = await uno('select animo_mios()');
check(rincon.length === 2 && rincon.some((x) => x.autor === 'Tu coach' && /más fuerte/.test(x.texto)) && rincon.some((x) => x.autor === 'Luis P.'), 'su rincón, con el texto y quién lo dijo');
check(await falla('select animo_fijar($1, $2, true)', ['chat', msgSuyo]) && await falla('select animo_fijar($1, $2, true)', ['chat', msgOtro])
  && await falla('select animo_fijar($1, $2, true)', ['comunidad', cEnOtro]) && await falla('select animo_fijar($1, $2, true)', ['otro', msgCoach]), 'sus propios mensajes, los del chat de otro o comentarios en publicaciones ajenas, no');
check(await falla('select animo_fijar($1, $2, true)', ['chat', msgProgramado]), '(revisión) un mensaje programado para más tarde, todavía no');
await uno('select animo_fijar($1, $2, true)', ['chat', msgCoach]);
check((await uno('select animo_mios()')).length === 2, 'fijar dos veces el mismo no lo repite');
await como(coach);
check((await uno('select animo_mios()')).length === 0 && await falla('select * from public.animo_fijados'), 'el coach no ve su rincón (ni la tabla)');
await como(luis);
check((await uno('select animo_mios()')).length === 0, 'otro atleta tampoco');
await su(); await q(`update public.comentarios set eliminado_en = now() where id = $1`, [msgCoach]); await q(`update public.comunidad_comentarios set oculto = true where id = $1`, [cLuis]);
await como(ana);
check((await uno('select animo_mios()')).length === 0, 'si el mensaje se borra o se oculta, deja de salir');
await su(); await q(`update public.comentarios set eliminado_en = null where id = $1`, [msgCoach]); await como(ana);
check(await uno('select animo_fijar($1, $2, false)', ['chat', msgCoach]) === false && (await uno('select animo_mios()')).length === 0, 'y se suelta');

console.log('\n3. La foto de portada');
const ruta = (perfil) => `${perfil}/${crypto.randomUUID()}.jpg`;
const rA = ruta(ana);
await como(ana);
check(!(await falla(`insert into storage.objects (bucket_id, name) values ('portadas', $1)`, [rA])), 'sube la suya a su carpeta');
check(await falla(`insert into storage.objects (bucket_id, name) values ('portadas', $1)`, [ruta(luis)]) && await falla(`insert into storage.objects (bucket_id, name) values ('portadas', $1)`, [`${ana}/x.png`]), 'en la carpeta de otro, o con otro nombre, no');
check(await uno('select portada_poner($1)', [rA]) === rA && await uno('select portada_de()') === rA, 'la pone y la ve');
check(await falla('select portada_poner($1)', [ruta(ana)]), 'una que no ha subido, no');
await como(luis);
check(await uno('select portada_de($1)', [ana]) === rA && (await q(`select name from storage.objects where bucket_id = 'portadas' and name = $1`, [rA])).length === 1, 'un compañero de la comunidad la ve');
await como(eva);
check(await uno('select portada_de($1)', [ana]) === null && (await q(`select name from storage.objects where bucket_id = 'portadas' and name = $1`, [rA])).length === 0, 'quien no está en la comunidad, no');
await como(coach);
check(await uno('select portada_de($1)', [ana]) === rA, 'el coach la ve');
check(await falla('select * from public.portadas') && await falla('select portada_poner($1)', [rA]), 'nadie toca la tabla; el coach no pone portadas');
await como(ana);
const rA2 = ruta(ana);
await q(`insert into storage.objects (bucket_id, name) values ('portadas', $1)`, [rA2]);
await uno('select portada_poner($1)', [rA2]);
await su();
check((await q(`select bucket from fbe_privado.storage_por_borrar where ruta = $1`, [rA]))[0]?.bucket === 'portadas', 'al cambiarla, la anterior a la cola de borrado (bucket «portadas»)');
await como(ana); await q('select portada_quitar()'); await su();
check((await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [rA2])).length === 1 && (await q('select 1 from public.portadas')).length === 0, 'al quitarla, también');
await como(ana);
check(await falla('select portada_poner($1)', [rA2]), 'una ya quitada no vuelve');
const rA3 = ruta(ana);
await q(`insert into storage.objects (bucket_id, name) values ('portadas', $1)`, [rA3]); await uno('select portada_poner($1)', [rA3]);
await su(); await q(`delete from public.perfiles where id = $1`, [ana]).catch(() => q(`delete from auth.users where id = $1`, [ana]));
check((await q(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [rA3])).length === 1, 'al borrarse el perfil, también');
check((await q(`select 1 from pg_proc p where proname = 'portada_fuera' and has_function_privilege('authenticated', p.oid, 'execute')`)).length === 0, 'la función del trigger no la puede llamar nadie');
const copia = await (async () => { await como(coach); return uno('select copia_privada()'); })();
check(Array.isArray(copia.portadas) && !('animo_fijados' in copia), 'la copia del coach lleva las portadas, pero no el rincón de ánimo');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
