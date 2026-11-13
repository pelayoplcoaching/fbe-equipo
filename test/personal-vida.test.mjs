// Que la app sepa de su vida, en la base: la migración 069 en un Postgres local (PGlite). Su agenda de vida (eventos,
// semanas difíciles, guardias, hitos y el reto del coach) y su manual de instrucciones.
//   node test/personal-vida.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
console.log('La migración 069 (PGlite)');
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
const ana = await usuario('a@x.test'), luis = await usuario('l@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const atletaL = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [luis]))[0].id;
const [{ d: hoy }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const mas = (n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const guardar = (atleta, datos) => q('select agenda_guardar($1, $2::jsonb) as a', [atleta, JSON.stringify(datos)]).then((r) => r[0].a);

await como(ana);
const ev = await guardar(null, { tipo: 'evento', fecha: mas(10), titulo: '  Examen   de oposición ', nota: 'El gordo' });
check(ev.titulo === 'Examen de oposición' && ev.autor === 'atleta' && ev.tipo === 'evento', 'el atleta apunta un evento de su vida (limpio)');
const d1 = await guardar(null, { tipo: 'dificil', fecha: mas(0) }), d2 = await guardar(null, { tipo: 'dificil', fecha: mas(0) });
check(d1.id === d2.id, 'una semana difícil por fecha (repetirla no duplica)');
await guardar(null, { tipo: 'guardia', fecha: mas(3) });
check(await falla(`select agenda_guardar(null, '{"tipo": "reto", "fecha": "${mas(1)}", "titulo": "x"}'::jsonb)`), 'el reto lo pone el coach, no él');
check(await falla(`select agenda_guardar(null, '{"tipo": "evento", "fecha": "${mas(1)}"}'::jsonb)`) && await falla(`select agenda_guardar(null, '{"tipo": "evento", "fecha": "${mas(800)}", "titulo": "x"}'::jsonb)`)
  && await falla(`select agenda_guardar(null, '{"tipo": "otro", "fecha": "${mas(1)}", "titulo": "x"}'::jsonb)`), 'sin nombre, fuera de fechas o de otro tipo, no');
check(await falla('select * from agenda_vida'), 'la tabla no se lee directamente');
// (revisión) lo que verá el coach, limpio: sin invisibles ni caracteres de dirección, y cada clave, texto
const limpio = await guardar(null, { tipo: 'evento', fecha: mas(3), titulo: 'Boda\u202e de\u200b Marta', nota: 'nota\u2066 rara' });
check(limpio.titulo === 'Boda de Marta' && limpio.nota === 'nota rara', '(revisión) el título y la nota, sin invisibles ni caracteres de dirección');
check(await falla(`select agenda_guardar(null, '{"tipo": "evento", "fecha": "${mas(4)}", "titulo": "\u200b\u200b"}'::jsonb)`) && await falla(`select agenda_guardar(null, '{"tipo": "evento", "fecha": "${mas(4)}", "titulo": {"x": 1}}'::jsonb)`),
  '(revisión) un título invisible o que no es texto, no');
check(await falla(`select agenda_responder($1, 'bien')`, [d1.id]), '(revisión) solo se contesta a un evento (no a una semana difícil)');
await q('select agenda_borrar($1)', [limpio.id]);
let lista = (await q('select agenda_lista() as l'))[0].l;
check(lista.length === 3 && lista[0].tipo === 'dificil', 'su agenda, por fecha');
const r = (await q(`select agenda_responder($1, 'bien', 'Aprobado!') as a`, [ev.id]))[0].a;
check(r.respuesta === 'bien' && r.respuesta_nota === 'Aprobado!' && r.respondida_en, 'contesta qué tal fue');
await como(luis);
check((await q('select agenda_lista() as l'))[0].l.length === 0, 'otro atleta no ve la suya');
check(await falla(`select agenda_responder($1, 'mal')`, [ev.id]) && await falla('select agenda_borrar($1)', [ev.id]), 'ni contesta ni borra lo de otro');

await como(coach, 'aal2');
lista = (await q('select agenda_lista($1) as l', [atletaA]))[0].l;
check(lista.length === 3 && lista.some((x) => x.respuesta === 'bien'), 'el coach ve su agenda (y lo que contestó)');
const reto = await guardar(atletaA, { tipo: 'reto', fecha: mas(0), titulo: '4 jueves seguidos' });
check(reto.autor === 'coach', 'el coach le pone el reto del mes');
check(await falla(`select agenda_lista(null)`), 'el coach dice de quién');
await como(ana);
check(await falla('select agenda_borrar($1)', [reto.id]), 'el atleta no borra lo que puso el coach');
await q('select agenda_borrar($1)', [ev.id]);
check(!(await q('select agenda_lista() as l'))[0].l.some((x) => x.id === ev.id), 'y sí lo suyo');

// manual
let [{ p }] = await q(`select personal_manual_guardar('{"manual_feedback": "suave", "manual_motiva": ["retos", "datos", "retos"], "manual_evitar": "Que me compares con otros"}'::jsonb) as p`);
check(p.manual_feedback === 'suave' && p.manual_motiva.length === 2 && p.manual_evitar === 'Que me compares con otros', 'su manual: feedback, lo que le motiva (sin repetir) y lo que no quiere oír');
check(await falla(`select personal_manual_guardar('{"manual_feedback": "borde"}'::jsonb)`) && await falla(`select personal_manual_guardar('{"manual_motiva": ["dinero"]}'::jsonb)`), 'solo lo de la lista');
[{ p }] = await q(`select personal_manual_guardar('{"manual_feedback": "directo"}'::jsonb) as p`);
check(p.manual_feedback === 'directo' && p.manual_motiva.length === 2 && p.manual_evitar === 'Que me compares con otros', '(revisión) lo que no viene se queda como estaba');
check(await falla(`select personal_manual_guardar('{"manual_evitar": {"x": 1}}'::jsonb)`) && await falla(`select personal_manual_guardar('{"manual_motiva": [1]}'::jsonb)`), '(revisión) cada clave con su tipo');
[{ p }] = await q(`select personal_manual_guardar('{"manual_feedback": "suave"}'::jsonb) as p`);
await como(coach, 'aal2');
const [{ l }] = await q('select personal_atletas() as l');
check(l.find((x) => x.atleta_id === atletaA)?.manual_feedback === 'suave', 'el coach ve su manual');
check(await falla(`select personal_manual_guardar('{"manual_feedback": "directo"}'::jsonb)`), 'y no lo escribe por él');
await su();
await q('update atletas set estado = $2 where id = $1', [atletaL, 'baja']);
await como(luis);
check(await falla(`select agenda_guardar(null, '{"tipo": "guardia", "fecha": "${mas(1)}"}'::jsonb)`), 'de baja, no apunta nada');
await su();
check((await q('select count(*)::int as n from fbe_migraciones where numero = 69'))[0].n === 1, 'la 069 queda apuntada');
console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
