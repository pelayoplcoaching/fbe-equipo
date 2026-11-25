// FBE Esencial, migración 098, contra el esquema real (PGlite, con RLS): el cierre de la semana de quien va por su cuenta
// (esencial_cerrar_semana: pasar, repetir, pausa y reanudar; el plan se corre con fbe_privado.esencial_correr) y sus
// avisos (crear_recordatorios, la de la 097 con tres bloques más: la pregunta del domingo, el cierre de las 23:30 y el
// lunes por la mañana).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });
if (hoyISO() !== fechaMadrid()) {
  console.log('  (ahora mismo, el día de este ordenador no es el de Madrid: se salta)');
  process.exit(0);
}
const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const q = (sql, p = []) => b.sql(sql, p);
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
const servidor = `${superusuario} set role service_role;`;
const hoy = hoyISO(), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6), proximo = sumarDias(lunes, 7);
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
for (const m of ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql', '094_esencial_piloto.sql', '095_esencial_cuestionario.sql', '096_esencial_dias.sql', '097_esencial_alta_avisos.sql', '098_esencial_cierre.sql']) await db.exec(SQL(m));
// (se puede repetir)
await db.exec(SQL('098_esencial_cierre.sql'));

console.log('La 098');
const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
const f097 = de(SQL('097_esencial_alta_avisos.sql')), f098 = de(SQL('098_esencial_cierre.sql'));
const corte = f097.lastIndexOf('  return v_n;');
check(f098.startsWith(f097.slice(0, corte)) && f098.endsWith('  return v_n;') && ['esencial_domingo:', 'esencial_auto:', 'esencial_lunes:'].every((k) => f098.slice(corte).includes(k)),
  'crear_recordatorios empieza exactamente como la de la 097 y añade sus tres bloques al final');
await db.exec(superusuario);
const cols = (await db.query(`select column_name c from information_schema.columns where table_schema = 'public' and table_name = 'semanas' and column_name like 'esencial_%' order by 1`)).rows.map((r) => r.c);
check(cols.join() === 'esencial_cierre,esencial_cierre_lunes,esencial_repetida' && (await q('select max(numero) n from fbe_migraciones'))[0].n >= 98, 'las tres columnas en semanas (y se puede repetir)');
const priv = (await db.query(`select has_function_privilege('anon', 'public.esencial_cerrar_semana(text, uuid)', 'execute') a, has_function_privilege('authenticated', 'public.esencial_cerrar_semana(text, uuid)', 'execute') u,
  has_function_privilege('authenticated', 'fbe_privado.esencial_correr(uuid, integer)', 'execute') p`)).rows[0];
check(priv.a === false && priv.u === true && priv.p === false, 'sin sesión no se puede llamar; la de correr el plan, nadie desde fuera');

// El coach da de alta a cuatro que empiezan esta semana y a Lucas, con seguimiento
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await q(`update perfiles set rol = 'coach' where id = $1`, [coachId]);
const alta = {};
for (const n of ['rosa', 'elena', 'dani', 'berta']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const id = {};
const entrar = async (n, codigo, esencial = true) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
  if (esencial) { await api.guardarCuestionario(id[n], limpio, { completar: true }); await api.esencialAsignarPlan(); }
};
for (const n of ['rosa', 'elena', 'dani', 'berta']) await entrar(n, alta[n].codigo);
await entrar('lucas', codLucas, false);
// (de jueves a domingo, la base pone su plan desde el lunes que viene: la 097, «desde el jueves, el siguiente». La prueba lo
// trae a este lunes, como si se hubiera dado de alta a principios de semana; si no, de jueves a domingo fallaba)
await db.exec(superusuario);
for (const n of ['rosa', 'elena', 'dani', 'berta']) {
  await db.query(`update sesiones s set dia_previsto = null from semanas w join bloques b on b.id = w.bloque_id where w.id = s.semana_id and b.atleta_id = $1 and not b.es_plantilla`, [id[n]]);
  await db.query(`update semanas w set fecha_inicio = $1::date + (w.numero - 1) * 7 from bloques b where b.id = w.bloque_id and b.atleta_id = $2 and not b.es_plantilla`, [lunes, id[n]]);
  await db.query(`update bloques set fecha_inicio = $1::date, fecha_fin = $1::date + 27 where atleta_id = $2 and not es_plantilla`, [lunes, id[n]]);
}
const semanas = async (n) => { await db.exec(superusuario); return (await db.query(`select w.id, w.numero, to_char(w.fecha_inicio, 'YYYY-MM-DD') inicio, w.esencial_cierre cierre, to_char(w.esencial_cierre_lunes, 'YYYY-MM-DD') cl, w.esencial_repetida rep,
  to_char(b.fecha_inicio, 'YYYY-MM-DD') bi, to_char(b.fecha_fin, 'YYYY-MM-DD') bf from semanas w join bloques b on b.id = w.bloque_id where b.atleta_id = $1 and not b.es_plantilla order by w.numero`, [id[n]])).rows; };
const como = (n) => b.auth.entrar(`${n}@test`, `clave-${n}@test`);
const antes = await semanas('rosa');
check(antes.length === 4 && antes[0].inicio === lunes && antes[0].rep === 0 && antes[0].cierre === null, 'Rosa: sus cuatro semanas desde este lunes, sin nada elegido');

console.log('\nLa pausa («Esta semana no puedo») y «Volver ya»');
await como('rosa');
const ses1 = (await api.programa(id.rosa)).sesiones[antes[0].id];
await api.planificarSesion(ses1[0].id, domingo);
let r = await api.esencialCerrarSemana('pausa');
let w = await semanas('rosa');
const dp = async (sid) => { await db.exec(superusuario); return (await db.query(`select to_char(dia_previsto, 'YYYY-MM-DD') d from sesiones where id = $1`, [sid])).rows[0].d; };
check(r.decision === 'pausa' && r.inicio === proximo && r.faltan === 2 && w.map((x) => x.inicio).join() === [7, 14, 21, 28].map((k) => sumarDias(lunes, k)).join()
  && w[0].cierre === 'pausa' && w[0].cl === lunes && w[0].rep === 0 && w[0].bi === proximo && w[0].bf === sumarDias(antes[0].bf, 7),
  'pausa: sus cuatro semanas (y su plan) se corren una; queda apuntado en la primera');
check(await dp(ses1[0].id) === sumarDias(domingo, 7), 'y la sesión que tenía día, una semana después');
await como('rosa');
check(/No tienes una semana en curso/.test((await falla(() => api.esencialCerrarSemana('pausa')))?.message || ''), 'en pausa ya no hay semana en curso que cerrar');
r = await api.esencialCerrarSemana('reanudar');
w = await semanas('rosa');
check(r.inicio === lunes && w.map((x) => x.inicio).join() === antes.map((x) => x.inicio).join() && w[0].cierre === null && w[0].cl === null && w[0].bi === lunes && w[0].bf === antes[0].bf && await dp(ses1[0].id) === domingo,
  '«Volver ya»: todo donde estaba');
await como('rosa');
check(/No tienes la semana en pausa/.test((await falla(() => api.esencialCerrarSemana('reanudar')))?.message || ''), 'sin pausa, nada que reanudar');

console.log('\nPasar o repetir');
if (hoy !== domingo) check(/domingo/.test((await falla(() => api.esencialCerrarSemana('repetir')))?.message || '') && /domingo/.test((await falla(() => api.esencialCerrarSemana('pasar')))?.message || ''), 'ella, solo el domingo');
else check(true, '(hoy es domingo: se salta lo de «solo el domingo»)');
check(/Elige/.test((await falla(() => api.esencialCerrarSemana('otra')))?.message || ''), 'y solo pasar, repetir, pausa o reanudar');
check(!!(await falla(() => api.esencialCerrarSemana('pausa', id.elena))), 'la semana de otra, no');
check(!!(await falla(() => b.update('semanas', { esencial_cierre: 'pasar' }, { eq: { id: antes[0].id } }).then((x) => { if (!x || !x.length) throw new Error('nada'); }))), 'y a mano no puede apuntarlo en su semana');
await como('lucas');
check(/por su cuenta/.test((await falla(() => api.esencialCerrarSemana('pausa')))?.message || ''), 'quien lleva seguimiento, tampoco');
// El coach, por ella (cualquier día): repetir
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
r = await api.esencialCerrarSemana('repetir', id.rosa);
w = await semanas('rosa');
check(r.decision === 'repetir' && r.inicio === proximo && w[0].inicio === proximo && w[0].rep === 1 && w[0].cierre === 'repetir' && w[0].cl === lunes && w[1].rep === 0 && w[3].inicio === sumarDias(lunes, 28),
  'repetir: como la pausa, y cuenta como repetida (solo esa semana)');
// pasar: Elena
r = await api.esencialCerrarSemana('pasar', id.elena);
w = await semanas('elena');
check(r.decision === 'pasar' && r.inicio === lunes && w[0].inicio === lunes && w[0].cierre === 'pasar' && w[0].cl === lunes && w[0].rep === 0, 'pasar: se apunta en su semana y nada se mueve');
// repetida ya dos veces: no más
await db.exec(superusuario);
await db.query('update semanas set esencial_repetida = 2 where id = $1', [(await semanas('dani'))[0].id]);
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
check(/dos veces/.test((await falla(() => api.esencialCerrarSemana('repetir', id.dani)))?.message || ''), 'una semana repetida dos veces ya no se repite');
await db.exec(superusuario);
await db.query('update semanas set esencial_repetida = 0 where id = $1', [(await semanas('dani'))[0].id]);
// con la semana completa, nada
await db.query('update sesiones set completada = true, fecha_realizada = $2 where semana_id = $1', [(await semanas('berta'))[0].id, hoy]);
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
check(/ya está completa/.test((await falla(() => api.esencialCerrarSemana('pausa', id.berta)))?.message || ''), 'con la semana completa, nada que cerrar');
const cierres = await api.esencialCierres(sumarDias(lunes, -7));
check(cierres.length === 2 && cierres.some((c) => c.cierre === 'repetir' && /rosa/.test(c.nombre) && c.repetida === 1) && cierres.some((c) => c.cierre === 'pasar' && /elena/.test(c.nombre)),
  'el panel del coach: quién ha repetido y quién ha pasado esta semana');

console.log('\nLos avisos del cierre');
// Dani y Elena, con los avisos por correo; Berta (semana completa) también; Rosa, sin avisos
await db.exec(superusuario);
const perfil = async (n) => (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
for (const n of ['dani', 'elena', 'berta']) await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true, silencio_desde = null, silencio_hasta = null`, [await perfil(n)]);
const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec(superusuario); };
const avisos = async (pref) => (await db.query(`select n.titulo, n.cuerpo, n.tipo, n.url, n.usuario_id from notificaciones n where n.clave like $1`, [`${pref}%`])).rows;
await llamar(domingo, '20:30');
check((await avisos('esencial_domingo:')).length === 0, 'el domingo antes de las 21:00, nada');
await llamar(domingo, '21:05');
await llamar(domingo, '21:06');
let a = await avisos('esencial_domingo:');
check(a.length === 1 && a[0].usuario_id === await perfil('dani') && a[0].tipo === 'semana' && a[0].url === '#hoy' && /Te quedan 2 sesiones/.test(a[0].cuerpo) && /23:30/.test(a[0].cuerpo),
  'a las 21:00: la pregunta, solo a Dani (Elena ya eligió, Berta la tiene completa, Rosa la repite y no tiene avisos), una sola vez');
check((await semanas('dani'))[0].cierre === null, 'y aún no se ha cerrado nada');
await llamar(domingo, '23:31');
await llamar(domingo, '23:45');
a = await avisos('esencial_auto:');
const wd = (await semanas('dani'))[0], we = (await semanas('elena'))[0];
check(wd.cierre === 'auto' && wd.cl === lunes && wd.inicio === lunes && we.cierre === 'pasar' && a.length === 1 && a[0].usuario_id === await perfil('dani') && /Como no has contestado, te hemos dejado programada tu siguiente semana/.test(a[0].cuerpo),
  'a las 23:30 sin elegir: se pasa a la siguiente (apuntado en su semana) y se le dice, una vez; lo de Elena no se toca');
// Sin avisos activados también se cierra: Rosa, si su semana estuviera en curso y sin elegir
await db.query(`update semanas set fecha_inicio = fecha_inicio - 7, esencial_cierre = null, esencial_cierre_lunes = null where bloque_id = (select bloque_id from semanas where id = $1)`, [(await semanas('rosa'))[0].id]);
await llamar(domingo, '23:50');
check((await semanas('rosa'))[0].cierre === 'auto' && (await avisos('esencial_auto:')).length === 1, 'quien no tiene los avisos activados: se cierra igual, sin aviso');
// El lunes por la mañana, sin la semana nueva preparada (a Dani se le quitan las que venían publicadas)
await db.query(`delete from semanas where numero > 1 and bloque_id = (select bloque_id from semanas where id = $1)`, [wd.id]);
await llamar(proximo, '07:00');
check((await avisos('esencial_lunes:')).length === 0, 'el lunes antes de su hora, nada');
await llamar(proximo, '08:45');
await llamar(proximo, '09:10');
a = await avisos('esencial_lunes:');
check(a.length === 1 && a[0].usuario_id === await perfil('dani') && a[0].titulo === 'Empieza tu semana' && /te prepara tu semana nueva/.test(a[0].cuerpo),
  'el lunes a su hora, sin semana nueva aún: «Empieza tu semana», solo a quien le falta (Elena y Berta tienen la suya publicada)');
await db.exec('reset role;');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
