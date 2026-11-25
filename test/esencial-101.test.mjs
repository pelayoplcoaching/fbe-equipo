// FBE Esencial, migración 101, contra el esquema real (PGlite, con RLS): «Me voy de viaje». Quien va por su cuenta apunta
// cuándo se va y cuándo vuelve (una nota de tipo 'viaje', de la 100) y, esos días, la base no le manda avisos de entreno
// («Hoy toca», la pregunta del domingo, el cierre solo, el del lunes…); a la vuelta, «¿Ya de vuelta?». Con «sigo igual»,
// todo como siempre. Y lo demás de la tanda 6 que guarda algo: su objetivo y su semana suave (sin nada de salud).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as datos from '../web/src/datos/api-esencial.js';
import { resumenCoach, viajeDe } from '../web/src/logica/esencial-vida.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) { console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)'); process.exit(0); }
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
const servidor = `${superusuario} set role service_role;`;
const hoy = hoyISO(), lunes = lunesDe(hoy);
await db.exec('reset role;');
await db.exec(SQL('101_esencial_viaje.sql'));
await db.exec(SQL('101_esencial_viaje.sql'));   // (se puede repetir)

console.log('La 101');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'fbe_privado.esencial_de_viaje(uuid, date)', 'execute') a, has_function_privilege('authenticated', 'fbe_privado.esencial_de_viaje(uuid, date)', 'execute') u,
  has_function_privilege('anon', 'public.crear_recordatorios(timestamptz)', 'execute') ra, has_function_privilege('authenticated', 'public.crear_recordatorios(timestamptz)', 'execute') ru,
  has_function_privilege('service_role', 'public.crear_recordatorios(timestamptz)', 'execute') rs, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(priv.a === false && priv.u === false && priv.ra === false && priv.ru === false && priv.rs === true && Number(priv.n) === 101,
  'la pregunta «¿está de viaje?» es privada (ni sin sesión ni con ella); los recordatorios, solo el servidor; la base queda en la 101');
{
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f100 = de(SQL('100_esencial_acompanado.sql')), f101 = de(SQL('101_esencial_viaje.sql'));
  const sin = f101.split(' and not fbe_privado.esencial_de_viaje(d.atleta_id, v_hoy)').join('').split('\n          and not fbe_privado.esencial_de_viaje(a.id, v_hoy)').join('')
    .split('\n        and not fbe_privado.esencial_de_viaje(c.atleta_id, v_hoy)').join('').split('returning a.perfil_id, a.id as atleta_id').join('returning a.perfil_id');
  check(sin.startsWith(f100.slice(0, f100.lastIndexOf('  return v_n;'))) && (f101.match(/fbe_privado\.esencial_de_viaje\(/g) || []).length === 11 && f101.endsWith('  return v_n;') && /'#hoy\/viaje', 'esencial_viaje:'/.test(f101.slice(f100.length - 40)),
    'crear_recordatorios es la de la 100 con la pregunta del viaje en los diez avisos de entreno de FBE Esencial y un bloque más al final (la vuelta), a prueba de fallos');
  check((SQL('101_esencial_viaje.sql').match(/create table|alter table|drop /g) || []).length === 0, 'no toca ninguna tabla');
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla']) await entrar(n, alta[n].codigo);
await entrar('lucas', codLucas);

console.log('\nApuntar el viaje');
const miercoles = sumarDias(lunes, 2), domingo = sumarDias(lunes, 6), lunes2 = sumarDias(lunes, 7), vuelve = sumarDias(lunes, 9), jueves2 = sumarDias(lunes, 10);
await como('ana');
let r = await datos.apuntarViaje(b, id.ana, { desde: sumarDias(lunes, 1), hasta: sumarDias(lunes, 3), modo: 'viaje' }, { hoy: lunes });
r = await datos.apuntarViaje(b, id.ana, { desde: lunes, hasta: vuelve, modo: 'pausa' }, { hoy: lunes });
let mias = await datos.notas(b, id.ana, 'viaje');
check(r?.id && mias.length === 1 && String(mias[0].desde).slice(0, 10) === lunes && String(mias[0].hasta).slice(0, 10) === vuelve && mias[0].datos.modo === 'pausa' && mias[0].texto === null
  && viajeDe(mias, miercoles)?.estado === 'durante', 'Ana apunta su viaje (uno cada vez: el nuevo quita el que tenía por delante); se guardan las fechas y qué va a hacer');
let e = await falla(() => b.insert('esencial_notas', [{ atleta_id: id.ana, tipo: 'viaje', desde: lunes, hasta: sumarDias(lunes, 200), datos: { modo: 'pausa' } }]));
check(!!e, 'un viaje de más de 120 días no entra');
await como('carla');
await datos.apuntarViaje(b, id.carla, { desde: lunes, hasta: vuelve, modo: 'igual' }, { hoy: lunes });
check((await datos.notas(b, id.carla, 'viaje')).length === 1 && (await b.select('esencial_notas', { eq: { tipo: 'viaje' } })).length === 1, 'Carla apunta el suyo («sigo igual») y solo ve el suyo');
await como('lucas');
e = await falla(() => b.insert('esencial_notas', [{ atleta_id: id.lucas, tipo: 'viaje', desde: lunes, hasta: vuelve, datos: { modo: 'pausa' } }]));
check(!!e && (await b.select('esencial_notas', {})).length === 0, 'quien lleva seguimiento no apunta viajes aquí ni ve los de nadie');
await db.exec(superusuario);
const viaja = async (n, dia) => (await db.query('select fbe_privado.esencial_de_viaje($1, $2::date) v', [n ? id[n] : null, dia])).rows[0].v;
check((await viaja('ana', lunes)) === true && (await viaja('ana', vuelve)) === true && (await viaja('ana', jueves2)) === false && (await viaja('ana', sumarDias(lunes, -1))) === false
  && (await viaja('carla', miercoles)) === false && (await viaja('berta', miercoles)) === false && (await viaja(null, miercoles)) === false,
  '¿está de viaje ese día?: Ana, del primer día al último; Carla («sigo igual»), no; Berta (sin viaje) y nadie, tampoco');

console.log('\nLos avisos de entreno, callados mientras está fuera');
const ej = (await db.query(`insert into ejercicios (nombre, grupos_musculares, tipo) values ('Prensa de prueba (101)', '{}', '{multiarticular}') returning id`)).rows[0].id;
const semanaDe = {};
for (const n of ['ana', 'berta', 'carla']) {
  await db.query(`update atletas set estado = 'activo' where id = $1`, [id[n]]);
  const bl = (await db.query(`insert into bloques (es_plantilla, atleta_id, nombre, estado, fecha_inicio, numero) values (false, $1, 'Novato 2 días · FBE Esencial', 'activo', $2, 1) returning id`, [id[n], lunes])).rows[0].id;
  const w = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, lunes])).rows[0].id;
  semanaDe[n] = { bloque: bl, semana: w };
  for (let i = 1; i <= 2; i++) {
    const s = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, dia_previsto) values ($1, $2, $3, 'fuerza', false, $4) returning id`, [w, i, `Día ${i}`, i === 1 ? miercoles : sumarDias(lunes, 4)])).rows[0].id;
    await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, 1, 3, 10, 12)`, [s, ej]);
  }
}
const perfil = async (n) => (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
const P = {};
for (const n of ['ana', 'berta', 'carla']) {
  P[n] = await perfil(n);
  await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true, silencio_desde = null, silencio_hasta = null`, [P[n]]);
}
const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec(superusuario); };
const avisos = async (pref) => (await db.query(`select n.titulo, n.cuerpo, n.tipo, n.url, n.usuario_id from notificaciones n where n.clave like $1`, [`${pref}%`])).rows;
const quienes = (filas) => filas.map((x) => Object.keys(P).find((n) => P[n] === x.usuario_id) || '?').sort().join();

await llamar(miercoles, '08:35');
let a = await avisos(`recordatorio_sesion:${miercoles}`);
check(quienes(a) === 'berta,carla' && a.every((x) => x.titulo === 'Hoy toca Día 1'), `«Hoy toca», el día de su sesión: a Berta y a Carla; a Ana, de viaje, no (${quienes(a)})`);
await llamar(domingo, '21:05');
a = await avisos('esencial_domingo:');
check(quienes(a) === 'berta,carla' && a.every((x) => x.url === '#hoy/domingo'), `la pregunta del domingo: a Ana tampoco (${quienes(a)})`);
await llamar(domingo, '22:05');
a = await avisos('esencial_auto:');
const cierres = (await db.query(`select esencial_cierre c from semanas where id = any ($1)`, [Object.values(semanaDe).map((x) => x.semana)])).rows.map((x) => x.c).join();
check(cierres === 'auto,auto,auto' && quienes(a) === 'berta,carla', `el cierre solo del domingo se hace para las tres (su plan no se para), pero a Ana no se le avisa (${quienes(a)})`);
await llamar(lunes2, '08:35');
a = await avisos('esencial_lunes:');
check(quienes(a) === 'berta,carla' && a.every((x) => x.titulo === 'Empieza tu semana'), `el aviso del lunes: a Ana, que sigue fuera, no (${quienes(a)})`);
check((await avisos('esencial_viaje:')).length === 0, 'y mientras está fuera, nada de «¿Ya de vuelta?»');

console.log('\nA la vuelta');
await llamar(jueves2, '07:30');
check((await avisos('esencial_viaje:')).length === 0, 'la mañana siguiente a volver, antes de su hora, aún nada');
// (ese jueves, además, Ana tiene sesión puesta, en su semana siguiente)
{
  const w2 = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 2, $2, 'programada') returning id`, [semanaDe.ana.bloque, lunes2])).rows[0].id;
  const s2 = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, dia_previsto) values ($1, 1, 'Día 1', 'fuerza', false, $2) returning id`, [w2, jueves2])).rows[0].id;
  await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, 1, 3, 10, 12)`, [s2, ej]);
}
await llamar(jueves2, '08:35');
await llamar(jueves2, '08:50');
a = await avisos('esencial_viaje:');
check(a.length === 1 && a[0].usuario_id === P.ana && a[0].titulo === '¿Ya de vuelta?' && a[0].url === '#hoy/viaje' && a[0].tipo === 'sesion_hoy' && a[0].cuerpo.length <= 160 && /sin prisa/.test(a[0].cuerpo),
  'a su hora: «¿Ya de vuelta?», una vez, a Ana, que lleva a su tarjeta (a Carla, que siguió igual, no)');
a = await avisos(`recordatorio_sesion:${jueves2}`);
check(quienes(a) === 'ana', 'y sus avisos de entreno vuelven: ese mismo día, «Hoy toca»');
await llamar(sumarDias(jueves2, 1), '08:35');
check((await avisos('esencial_viaje:')).length === 1, 'al día siguiente no se repite');
await como('ana');
await datos.quitarNota(b, mias[0].id);
await db.exec(superusuario);
check((await viaja('ana', miercoles)) === false, 'si quita el viaje, deja de contar');

console.log('\nLo demás que se guarda: su objetivo y su semana suave (sin nada de salud)');
await como('berta');
r = await datos.apuntarObjetivo(b, id.berta, { texto: 'No faltar ninguna semana hasta el verano', fecha: sumarDias(hoy, 200) });
check(r?.id && r.desde === null && String(r.hasta).slice(0, 10) === sumarDias(hoy, 200), 'un objetivo a más de 120 días entra (solo lleva la fecha de llegada)');
await datos.apuntarObjetivo(b, id.berta, { texto: 'No faltar hasta junio', fecha: sumarDias(hoy, 150) });
r = await datos.pedirSuave(b, id.berta, { hoy });
let nv = await datos.notasVida(b, id.berta);
check(nv.objetivo.length === 1 && nv.objetivo[0].texto === 'No faltar hasta junio' && nv.suave.length === 1 && String(nv.suave[0].desde).slice(0, 10) === lunes && nv.viaje.length === 0, 'uno cada vez; la semana suave guarda su lunes, nada más');
e = await falla(() => b.update('esencial_notas', { texto: 'Otra cosa' }, { eq: { id: nv.objetivo[0].id } }));
const tras = await datos.notasVida(b, id.berta);
check(tras.objetivo[0].texto === 'No faltar hasta junio', 'una nota no se cambia: se quita y se apunta otra');
{
  await db.exec(superusuario);
  const cols = (await db.query(`select column_name c from information_schema.columns where table_schema = 'public' and table_name = 'esencial_notas'`)).rows.map((x) => x.c).sort().join();
  check(cols === 'atleta_id,creada_en,datos,desde,hasta,id,pregunta_publica,publica,respondida_en,respuesta,texto,tipo' && !/salud|molestia|enferm|dolor/.test(cols), 'la tabla sigue sin columnas de salud');
}

console.log('\nEl resumen de la semana, para el coach');
await como('carla');
await datos.apuntarViaje(b, id.carla, { desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, 3), modo: 'pausa' }, { hoy });
await db.exec(superusuario);
await db.query(`update semanas set esencial_cierre = null, esencial_cierre_lunes = null where id = any ($1)`, [Object.values(semanaDe).map((x) => x.semana)]);
await db.query(`update sesiones set completada = true, fecha_realizada = $1 where semana_id = $2`, [hoy, semanaDe.berta.semana]);
await db.query(`update sesiones set completada = true, fecha_realizada = $1 where semana_id = $2 and orden = 1`, [hoy, semanaDe.ana.semana]);
await como('coach');
const todo = await datos.semanaDeTodos(b, { hoy });
const res = resumenCoach(todo);
const fila = (n) => todo.filas.find((f) => f.atleta_id === id[n]);
check(fila('berta').hechas === 2 && fila('berta').total === 2 && fila('ana').hechas === 1 && fila('carla').viaje === true && !fila('ana').viaje && !todo.filas.some((f) => f.atleta_id === id.lucas),
  'una fila por cada uno de FBE Esencial: lo hecho de su semana y quién está de viaje (quien lleva seguimiento no sale)');
check(res.total === 3 && res.entrenando === 2 && res.completas === 1 && res.viaje === 1 && res.frase === 'De 2 personas con semana en marcha, 2 han entrenado y una la tiene completa.', `y su frase: «${res.frase}»`);
await como('ana');
e = await falla(() => datos.semanaDeTodos(b, { hoy }));
const suya = e ? null : await datos.semanaDeTodos(b, { hoy });
check(!!e || (suya.filas.length <= 1 && suya.filas.every((f) => f.atleta_id === id.ana)), 'un atleta no saca el resumen de los demás (las filas de otros no se le dan)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
