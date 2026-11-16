// La foto del plato y comer fuera (migración 079): la lógica, la demo y la base (PGlite).
//   node test/platos.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const P = await import('../web/src/logica/platos.js');
const { copiarMenu } = await import('../web/src/logica/comidas.js');
const { sumarDias, fechaMadrid, lunesDe } = await import('../web/src/logica/fechas.js');
const jpeg = (n) => `data:image/jpeg;base64,${'A'.repeat(n)}`;

console.log('La lógica');
check(P.fotoValida(jpeg(400)) && !P.fotoValida(jpeg(10)) && !P.fotoValida(jpeg(P.MAX_FOTO)) && !P.fotoValida(`data:image/png;base64,${'A'.repeat(400)}`) && !P.fotoValida(null)
  && !P.fotoValida(`${jpeg(400)}"><script>`) && P.fotoValida(jpeg(400), P.MAX_MINI) && !P.fotoValida(jpeg(P.MAX_MINI), P.MAX_MINI) && P.MAX_FOTO < 400000 && P.MAX_MINI < 24000,
  'la foto: un JPEG como data URL, dentro de lo que admite la base');
check(P.fotoVigente(new Date(Date.now() - 29 * 864e5).toISOString()) && !P.fotoVigente(new Date(Date.now() - 31 * 864e5).toISOString()) && !P.fotoVigente('nada') && P.DIAS_FOTO === 30, 'se ve 30 días');
check(P.fechaAdmiteFoto('2026-11-16', '2026-11-16') && P.fechaAdmiteFoto('2026-11-09', '2026-11-16') && P.fechaAdmiteFoto('2026-11-17', '2026-11-16') && !P.fechaAdmiteFoto('2026-11-08', '2026-11-16')
  && !P.fechaAdmiteFoto('2026-11-18', '2026-11-16') && !P.fechaAdmiteFoto('ayer', '2026-11-16'), 'la foto, de una comida de los últimos 7 días (o de mañana, por los viajes)');
check(P.proteinaPorComida(150, ['desayuno', 'comida', 'cena']) === 50 && P.proteinaPorComida(150, ['desayuno', 'comida', 'merienda', 'cena']) === 40 && P.proteinaPorComida(300, ['comida', 'cena']) === 60
  && P.proteinaPorComida(60, ['desayuno', 'comida', 'merienda', 'cena']) === 20 && P.proteinaPorComida(null, []) === null && P.proteinaPorComida(0, ['comida']) === null, 'la proteína a buscar: la del día entre sus comidas, de 20 a 60 g');
{
  const c = P.pautaFuera({ toma: 'cena', proteina: 40 }), d = P.pautaFuera({ toma: 'desayuno' }), s = P.pautaFuera({ toma: 'comida' });
  check(c.puntos.length === 5 && /unos 40 g/.test(c.puntos[0]) && d.puntos.length === 4 && !/ g\./.test(d.puntos[0]) && /palma de tu mano/.test(s.puntos[0]) && c.titulo !== d.titulo
    && [...c.puntos, ...d.puntos, ...s.puntos].every((x) => x.length <= 170), 'la pauta de comer fuera: corta, con su proteína si tiene plan, distinta para el desayuno y la merienda');
}
check(Object.keys(P.fotosPorDia([{ fecha: '2026-11-16', entrada_id: 'a' }, { fecha: '2026-11-16', entrada_id: 'b' }, { fecha: '2026-11-17', entrada_id: 'c' }])).length === 2, 'las fotos de la semana, por días');
{
  const copia = copiarMenu([{ fecha: '2026-11-16', toma: 'comida', texto: 'Arroz', raciones: 1 }, { fecha: '2026-11-16', toma: 'cena', texto: 'Foto del plato', raciones: 1, con_foto: true }, { fecha: '2026-11-17', toma: 'cena', texto: 'Comida fuera', raciones: 1, fuera: true },
    { fecha: '2026-11-17', toma: 'comida', texto: 'Pollo al curry', receta_id: 'r1', raciones: 1, con_foto: true, hecho: true }], '2026-11-16', '2026-11-23');
  check(copia.length === 2 && copia[1].receta_id === 'r1' && copia[1].hecho === false && copia[1].con_foto === undefined, 'al copiar la semana, ni las comidas fuera ni las que nacieron de una foto (una receta con foto sí, ya sin foto)');
}

console.log('\nEn la demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
const hoy = fechaMadrid(), lunes = lunesDe(hoy);
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const ana = (await api.atletas()).find((a) => /Ana/.test(a.nombre)), ruben = (await api.atletas()).find((a) => /Rubén/.test(a.nombre));
check((await api.platosDisponibles()) === true && Object.keys(await api.platosDeLaSemana(lunes)).length === 0, 'la demo tiene la 079; nadie ha subido fotos');
const delCoach = await api.apuntarMenu(ana.id, { fecha: hoy, toma: 'cena', texto: 'Salmón con verduras' });
check(await lanza(() => api.guardarFotoPlato(ana.id, { entrada: delCoach, foto: jpeg(900), mini: jpeg(300) })) && await lanza(() => api.crear('menu_fotos', { entrada_id: delCoach.id, atleta_id: ana.id, fecha: hoy, foto: jpeg(900), mini: jpeg(300) })),
  'el coach no sube fotos de platos');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
const f1 = await api.guardarFotoPlato(ana.id, { fecha: hoy, toma: 'comida', foto: jpeg(900), mini: jpeg(300) });
let menu = await api.menuSemana(ana.id, lunes);
check(f1.hecho && f1.con_foto && menu.find((e) => e.id === f1.id)?.texto === P.TEXTO_FOTO && menu.find((e) => e.id === f1.id).hecho && menu.find((e) => e.id === f1.id).con_foto, 'el atleta hace la foto: la comida queda apuntada y hecha');
await api.guardarFotoPlato(ana.id, { entrada: delCoach, foto: jpeg(1200), mini: jpeg(350) });
menu = await api.menuSemana(ana.id, lunes);
check(menu.find((e) => e.id === delCoach.id).hecho && menu.find((e) => e.id === delCoach.id).con_foto && menu.find((e) => e.id === delCoach.id).texto === 'Salmón con verduras', 'y la de algo que ya estaba en el menú: queda hecho, con su nombre');
const minis = await api.fotosPlatos(ana.id, lunes, sumarDias(lunes, 6));
check(minis.length === 2 && minis.every((m) => m.mini && m.foto === undefined) && (await api.fotoPlato(f1.id)).foto === jpeg(900) && (await api.fotoPlato(delCoach.id)).foto === jpeg(1200), 'las miniaturas de la semana y la foto entera, al abrirla');
await api.guardarFotoPlato(ana.id, { entrada: delCoach, foto: jpeg(1000), mini: jpeg(350) });
check((await api.fotosPlatos(ana.id, lunes, sumarDias(lunes, 6))).length === 2 && (await api.fotoPlato(delCoach.id)).foto === jpeg(1000), 'cambiar la foto no la duplica');
check(await lanza(() => api.guardarFotoPlato(ana.id, { fecha: hoy, toma: 'cena', foto: 'data:image/png;base64,AAAA', mini: jpeg(300) })) && await lanza(() => b.rpc('plato_foto_guardar', { p_entrada: f1.id, p_foto: jpeg(400001), p_mini: jpeg(300) }))
  && await lanza(() => api.guardarFotoPlato(ana.id, { fecha: sumarDias(hoy, -9), toma: 'cena', foto: jpeg(900), mini: jpeg(300) })) && (await api.menuSemana(ana.id, lunesDe(sumarDias(hoy, -9)))).every((e) => e.texto !== P.TEXTO_FOTO)
  && await lanza(() => api.actualizar('menu_fotos', f1.id, { foto: jpeg(500) })), 'una foto que no vale, demasiado grande o de hace más de una semana, no (y no deja la comida a medias)');
await api.cambiarMenu(menu.find((e) => e.id === f1.id), { con_foto: false });
check((await api.menuSemana(ana.id, lunes)).find((e) => e.id === f1.id).con_foto === true, '«tiene foto» lo lleva la base: desde la app no se cambia');
const fu = await api.apuntarFuera(ana.id, { fecha: hoy, toma: 'cena', texto: '  Cena con amigos ' });
const fu2 = await api.apuntarFuera(ana.id, { fecha: sumarDias(hoy, 1), toma: 'comida', hecho: false });
check(fu.fuera && fu.hecho && fu.texto === 'Cena con amigos' && fu.kcal === null && fu2.texto === P.TEXTO_FUERA && fu2.fuera && !fu2.hecho, 'comer fuera: cuenta como hecha (la de mañana, apuntada sin hacer)');
const unaReceta = (await api.recetario(ana.id)).recetas[0]?.id || 'r';
check(await lanza(() => api.crear('menu_comidas', { atleta_id: ana.id, fecha: hoy, toma: 'cena', texto: 'x', fuera: true, receta_id: unaReceta })), 'comer fuera no es una receta');
const datos = await api.exportarAtleta?.(ana.id).catch(() => null);
check(!datos || (datos.menu_fotos || []).length === 2, 'las fotos van en la descarga de sus datos');
check(await lanza(() => api.cambiarMenu(menu.find((e) => e.id === f1.id), { fecha: sumarDias(hoy, -1) })), 'una comida con foto no se cambia de día');
await b.auth.salir();
await b.auth.entrar('ruben@fbe.demo', 'demo');
check((await api.fotosPlatos(ana.id, lunes, sumarDias(lunes, 6))).length === 0 && (await api.fotoPlato(f1.id)) === null && await lanza(() => api.quitarFotoPlato(f1.id)) && await lanza(() => b.rpc('plato_foto_guardar', { p_entrada: f1.id, p_foto: jpeg(900), p_mini: jpeg(300) })),
  'otro atleta no ve, cambia ni quita las fotos de nadie');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.platosDeLaSemana(lunes))[ana.id] === 2 && (await api.fotosPlatos(ana.id, lunes, sumarDias(lunes, 6))).length === 2 && (await api.fotoPlato(f1.id)).foto === jpeg(900), 'el coach las ve: cuántas esta semana, las miniaturas y la foto');
await api.quitarFotoPlato(f1.id);
menu = await api.menuSemana(ana.id, lunes);
check((await api.platosDeLaSemana(lunes))[ana.id] === 1 && menu.find((e) => e.id === f1.id).con_foto === false && menu.find((e) => e.id === f1.id).hecho, 'y puede quitar una (la comida sigue hecha)');
await api.borrarMenu(delCoach.id);
check((await api.platosDeLaSemana(lunes))[ana.id] === undefined, 'al quitar la comida del menú, su foto se va con ella');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
await api.guardarFotoPlato(ana.id, { fecha: hoy, toma: 'merienda', texto: 'Yogur', foto: jpeg(900), mini: jpeg(300) });
{ const mio = (await b.select('consentimientos', {})).find((c) => c.tipo === 'datos_salud' && !c.revocado_en); await api.revocarConsentimiento(mio.id); }
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.platosDeLaSemana(lunes))[ana.id] === undefined && (await api.menuSemana(ana.id, lunes)).every((e) => !e.con_foto), 'al retirar el consentimiento de salud, sus fotos se borran');

console.log('\nLa migración 079 (PGlite)');
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
const uA = await usuario('a@x.test'), uL = await usuario('l@x.test');
const A = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [uA]))[0].id;
const L = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [uL]))[0].id;
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', 'x')`, [uA]);
const [{ d: hoyB }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const F = jpeg(900), M = jpeg(300);

await como(uA);
const [e1] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto, con_foto) values ($1, $2, 'comida', 'Foto del plato', true) returning *`, [A, hoyB]);
check(e1.con_foto === false && e1.fuera === false, 'al apuntar, «tiene foto» no se puede poner a mano');
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
let [m1] = await q('select * from menu_comidas where id = $1', [e1.id]);
check(m1.con_foto && m1.hecho && (await q('select entrada_id, fecha::text f, atleta_id from menu_fotos'))[0].f === hoyB, 'el atleta sube la foto: la comida queda hecha y con foto');
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, jpeg(1000), M]);
check((await q('select foto from menu_fotos')).length === 1 && (await q('select foto from menu_fotos'))[0].foto === jpeg(1000), 'cambiarla no la duplica');
check((await q(`update menu_comidas set con_foto = false where id = $1 returning con_foto`, [e1.id]))[0].con_foto === true && await falla(`insert into menu_fotos (entrada_id, atleta_id, fecha, foto, mini) values ($1, $2, $3, $4, $5)`, [e1.id, A, hoyB, F, M])
  && await falla(`update menu_fotos set foto = $1`, [F]) && await falla(`delete from menu_fotos`), 'la tabla de fotos solo se lee: ni insertar, ni cambiar, ni borrar a mano (y «tiene foto» tampoco)');
check(await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, 'data:image/png;base64,AAAA', M]) && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, jpeg(400001), M]) && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, jpeg(24001)])
  && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, null]) && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, `${F}"onerror="x`, M]), 'una foto que no es un JPEG o que pesa de más, no');
const [vieja] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'cena', 'Cena') returning *`, [A, sumarDias(hoyB, -8)]);
const [futura] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'cena', 'Cena') returning *`, [A, sumarDias(hoyB, 2)]);
check(await falla('select plato_foto_guardar($1, $2, $3)', [vieja.id, F, M]) && await falla('select plato_foto_guardar($1, $2, $3)', [futura.id, F, M]), 'solo de una comida de los últimos 7 días (o de mañana)');
const [{ id: nuevaId }] = await q(`select plato_foto_guardar(null, $1, $2, $3, 'merienda', '  Yogur con fruta ') as id`, [F, M, sumarDias(hoyB, -1)]);
const [nueva] = await q('select * from menu_comidas where id = $1', [nuevaId]);
check(nueva.texto === 'Yogur con fruta' && nueva.hecho && nueva.con_foto && nueva.atleta_id === A && (await q(`select plato_foto_guardar(null, $1, $2, $3, 'cena') as id`, [F, M, hoyB]))[0].id
  && await falla(`select plato_foto_guardar(null, $1, $2, $3, 'cena')`, [F, M, sumarDias(hoyB, -8)]) && await falla(`select plato_foto_guardar(null, $1, $2, $3, 'brunch')`, [F, M, hoyB]) && await falla(`select plato_foto_guardar(null, $1, $2)`, [F, M])
  && await falla(`select plato_foto_guardar(null, 'x', $1, $2, 'cena')`, [M, hoyB]) && (await q(`select count(*)::int n from menu_comidas where atleta_id = $1 and fecha = $2`, [A, sumarDias(hoyB, -8)]))[0].n === 1,
  'la foto de una comida nueva: se apuntan las dos cosas a la vez, o ninguna');
check(await falla(`update menu_comidas set fecha = $2 where id = $1`, [nuevaId, sumarDias(hoyB, -3)]) && (await q(`update menu_comidas set texto = 'Yogur' where id = $1 returning texto`, [nuevaId]))[0].texto === 'Yogur', 'una comida con foto no se cambia de día (lo demás sí)');
await q('delete from menu_comidas where id = $1 or (fecha = $2 and toma = $3 and con_foto)', [nuevaId, hoyB, 'cena']);
const [fuB] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto, fuera, hecho) values ($1, $2, 'cena', 'Comida fuera', true, true) returning *`, [A, hoyB]);
check(fuB.fuera && fuB.hecho && await falla(`insert into menu_comidas (atleta_id, fecha, toma, texto, fuera, receta_id) values ($1, $2, 'cena', 'x', true, gen_random_uuid())`, [A, hoyB]), 'comer fuera: cuenta como hecha y no es una receta');
for (let i = 0; i < 11; i++) { const [x] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'merienda', $3) returning id`, [A, hoyB, `n${i}`]); await q('select plato_foto_guardar($1, $2, $3)', [x.id, F, M]); }
const [tope] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'merienda', 'la 13') returning id`, [A, hoyB]);
check(await falla('select plato_foto_guardar($1, $2, $3)', [tope.id, F, M]) && !(await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M])), 'como mucho, 12 fotos por día (cambiar una de ellas sí)');

await como(uL);
const [eL] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'comida', 'Arroz') returning *`, [L, hoyB]).catch(() => [null]);
check(!eL && (await q('select * from menu_fotos')).length === 0 && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]) && await falla('select plato_foto_quitar($1)', [e1.id]), 'otro atleta no ve, cambia ni quita las fotos de nadie (y sin consentimiento de salud no tiene menú)');
await su();
const [eL2] = await q(`insert into menu_comidas (atleta_id, fecha, toma, texto) values ($1, $2, 'comida', 'Arroz') returning *`, [L, hoyB]);
await como(uL);
check(await falla('select plato_foto_guardar($1, $2, $3)', [eL2.id, F, M]), 'sin su consentimiento de datos de salud, no se guarda la foto');
await su();
await db.exec('reset role; set role anon;');
check(await falla('select * from menu_fotos') && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]), 'sin sesión, nada');
await como(coach, 'aal2');
check((await q('select * from menu_fotos')).length === 12 && await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]) && await falla(`select plato_foto_guardar(null, $1, $2, $3, 'cena')`, [F, M, hoyB]), 'el coach las ve todas; subir, solo el atleta');
await q('select plato_foto_quitar($1)', [e1.id]);
[m1] = await q('select * from menu_comidas where id = $1', [e1.id]);
check((await q('select * from menu_fotos')).length === 11 && !m1.con_foto && m1.hecho, 'el coach quita una: la comida sigue hecha, ya sin foto');

await su();
const [otra] = await q('select entrada_id from menu_fotos limit 1');
await q(`update menu_fotos set creado_en = now() - interval '31 days' where entrada_id = $1`, [otra.entrada_id]);
await como(coach, 'aal2');
check((await q('select * from menu_fotos')).length === 10, 'a los 30 días dejan de verse');
await como(uA);
check((await q('select * from menu_fotos')).length === 10, 'también para el atleta');
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
await su();
check((await q('select count(*)::int n from menu_fotos'))[0].n === 11 && (await q('select con_foto from menu_comidas where id = $1', [otra.entrada_id]))[0].con_foto === false
  && (await q('select hecho from menu_comidas where id = $1', [otra.entrada_id]))[0].hecho === true, 'y al subir otra se borran de verdad (la comida sigue hecha, sin foto)');
await q(`update menu_fotos set creado_en = now() - interval '40 days'`);
check((await q('select fbe_privado.platos_purgar() as n'))[0].n === 11 && (await q('select count(*)::int n from menu_fotos'))[0].n === 0 && (await q('select count(*)::int n from menu_comidas where con_foto'))[0].n === 0, 'la limpieza de cada noche las borra todas');
await como(uA);
check(await falla('select fbe_privado.platos_purgar()'), 'la limpieza no la llama nadie desde la app');
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
await su();
await q(`update menu_fotos set creado_en = now() - interval '31 days'`);
await como(uL);
await q('select platos_limpiar()');
await su();
check((await q('select count(*)::int n from menu_fotos'))[0].n === 0 && (await q('select con_foto from menu_comidas where id = $1', [e1.id]))[0].con_foto === false, 'al abrirse la app (cualquiera con sesión) se borran las caducadas, sin depender de pg_cron');
await db.exec('reset role; set role anon;');
check(await falla('select platos_limpiar()'), 'sin sesión, tampoco la limpieza');
await su();
await q(`update atletas set estado = 'baja' where id = $1`, [A]);
await como(uA);
check(await falla('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]), 'de baja no sube fotos');
await su();
await q(`update atletas set estado = 'activo' where id = $1`, [A]);
await como(uA);
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
await su();
await q(`update atletas set estado = 'baja' where id = $1`, [A]);
await como(uA);
await q('select plato_foto_quitar($1)', [e1.id]);
await su();
check((await q('select count(*)::int n from menu_fotos'))[0].n === 0, 'pero sí puede quitar las suyas');
await q(`update atletas set estado = 'activo' where id = $1`, [A]);
await como(uA);
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
await q(`update consentimientos set revocado_en = now() where perfil_id = $1 and tipo = 'datos_salud'`, [uA]);
await su();
check((await q('select count(*)::int n from menu_fotos'))[0].n === 0 && (await q('select count(*)::int n from menu_comidas where con_foto'))[0].n === 0 && (await q('select hecho from menu_comidas where id = $1', [e1.id]))[0].hecho, 'al retirar el consentimiento de salud se borran sus fotos (el menú se queda)');
await q(`insert into public.consentimientos (perfil_id, tipo, version) values ($1, 'datos_salud', 'y')`, [uA]);
await como(uA);
await q('select plato_foto_guardar($1, $2, $3)', [e1.id, F, M]);
await q('delete from menu_comidas where id = $1', [e1.id]);
await su();
check((await q('select count(*)::int n from menu_fotos'))[0].n === 0, 'la foto se borra con su comida');
await como(uA);
await q('select plato_foto_guardar($1, $2, $3)', [fuB.id, F, M]);
await su();
await q('delete from atletas where id = $1', [A]);
check((await q('select count(*)::int n from menu_fotos'))[0].n === 0, 'y con la ficha del atleta');
const mig = lee('supabase/migraciones/079_platos.sql'), m78 = lee('supabase/migraciones/078_pausas.sql');
const permisos = (s) => s.slice(s.indexOf('revoke truncate, references, trigger'), s.indexOf('insert into public.fbe_migraciones'));
check(/if v > 79 then/.test(mig) && /numero = 78\) then/.test(mig) && /values \(79\)/.test(mig)
  && permisos(mig).replace("-- (079) la de un trigger: nadie la llama\nrevoke execute on function public.menu_comida_con_foto() from public, anon, authenticated;\n", '') === permisos(m78), 'pide la 078; los permisos, los de la 078 más la función del trigger');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
