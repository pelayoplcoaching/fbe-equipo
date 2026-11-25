// FBE Esencial, migración 100, contra el esquema real (PGlite, con RLS): lo que quien va por su cuenta le cuenta a la app
// (esencial_notas: su pregunta para el directo, con su tope; lo que ve y toca cada uno), las dudas del directo hechas
// públicas sin quién preguntó (esencial_respuestas_publicas), las cifras del reto de la semana (esencial_equipo_semana) y
// los avisos, que ahora llevan a su explicación («#hoy/<aviso>»), con el de las agujetas tras su primera sesión.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as datos from '../web/src/datos/api-esencial.js';
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
await db.exec(SQL('100_esencial_acompanado.sql'));
await db.exec(SQL('100_esencial_acompanado.sql'));   // (se puede repetir)

console.log('La 100');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.esencial_respuestas_publicas()', 'execute') a, has_function_privilege('anon', 'public.esencial_equipo_semana()', 'execute') e,
  has_function_privilege('authenticated', 'public.esencial_respuestas_publicas()', 'execute') u, has_function_privilege('authenticated', 'public.esencial_nota_tope()', 'execute') t,
  has_table_privilege('anon', 'public.esencial_notas', 'select') ta, (select relrowsecurity from pg_class where oid = 'public.esencial_notas'::regclass) rls,
  (select max(numero) from fbe_migraciones) n`)).rows[0];
check(priv.a === false && priv.e === false && priv.u === true && priv.t === false && priv.ta === false && priv.rls === true && Number(priv.n) === 100,
  'sin sesión no se llama a nada ni se lee la tabla; la del disparador no la llama nadie; la tabla, con seguridad por filas; la base queda en la 100');

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const n of ['ana', 'berta']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes });
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
await entrar('ana', alta.ana.codigo);
await entrar('berta', alta.berta.codigo);
await entrar('lucas', codLucas);

console.log('\nSu pregunta para el directo');
await como('ana');
check((await datos.notas(b, id.ana, 'pregunta_directo')).length === 0, 'de entrada, ninguna');
const n1 = await datos.anotar(b, id.ana, 'pregunta_directo', { texto: '  En el peso muerto rumano noto más la espalda que la pierna, ¿qué miro?  ' });
check(n1?.id && n1.texto.startsWith('En el peso muerto') && n1.respuesta === null && n1.publica === false && String(n1.creada_en).slice(0, 10) >= sumarDias(hoy, -1), 'Ana manda su pregunta: queda guardada, sin respuesta');
let e = await falla(() => b.insert('esencial_notas', [{ atleta_id: id.ana, tipo: 'pregunta_directo', texto: 'Con fecha vieja, a ver si cuela', creada_en: '2020-01-01T10:00:00Z' }]));
await db.exec(superusuario);
check(!e && (await db.query(`select count(*)::int n from esencial_notas where creada_en < now() - interval '1 day'`)).rows[0].n === 0, 'la hora la pone la base (no vale mandarla desde fuera)');
await como('ana');
check(!!(await falla(() => b.insert('esencial_notas', [{ atleta_id: id.berta, tipo: 'pregunta_directo', texto: 'A nombre de otra persona' }]))), 'a nombre de otra persona, no');
check(!!(await falla(() => b.insert('esencial_notas', [{ atleta_id: id.ana, tipo: 'pregunta_directo', texto: 'Me contesto yo sola', respuesta: 'Sí, claro', respondida_en: new Date().toISOString() }])))
  && !!(await falla(() => b.insert('esencial_notas', [{ atleta_id: id.ana, tipo: 'pregunta_directo', texto: 'Y la hago pública', publica: true, respuesta: 'x', pregunta_publica: 'y' }]))), 'ni contestársela ni hacerla pública ella');
check(/esencial_notas_validas|check/i.test((await falla(() => datos.anotar(b, id.ana, 'molestia', { texto: 'Me duele la rodilla desde ayer' })))?.message || ''), 'solo los tipos previstos: nada de salud en esta tabla («molestia» no entra)');
check(!!(await falla(() => datos.anotar(b, id.ana, 'pregunta_directo', { texto: 'x'.repeat(601) }))), 'como mucho 600 caracteres');
const cambiada = await b.update('esencial_notas', { texto: 'La cambio después' }, { eq: { id: n1.id } }).catch(() => []);
check(!cambiada?.length && (await datos.notas(b, id.ana, 'pregunta_directo')).find((x) => x.id === n1.id).texto.startsWith('En el peso muerto'), 'una vez mandada no se cambia (se quita y se manda otra)');
// el tope: cinco al mes (lleva dos)
for (let i = 3; i <= 5; i++) await datos.anotar(b, id.ana, 'pregunta_directo', { texto: `Pregunta número ${i} de este mes` });
e = await falla(() => datos.anotar(b, id.ana, 'pregunta_directo', { texto: 'La sexta de este mes, que ya no entra' }));
check(/cinco preguntas este mes/.test(e?.message || '') && (await datos.notas(b, id.ana, 'pregunta_directo')).length === 5, `a la sexta del mes: «${(e?.message || '').slice(0, 70)}»`);
check(!!(await datos.anotar(b, id.ana, 'como_vamos', { datos: { nota: 9, semana: 4 }, texto: 'Echo de menos ver mis vídeos' }))?.id, 'el tope es de las preguntas: otra nota («¿Cómo vamos?») sí entra');
// Berta no ve las de Ana; Lucas (con seguimiento) no puede mandar
await como('berta');
check((await datos.notas(b, id.ana, 'pregunta_directo')).length === 0 && (await datos.notas(b, id.berta, 'pregunta_directo')).length === 0, 'Berta no ve las de Ana');
await datos.anotar(b, id.berta, 'pregunta_directo', { texto: 'Soy Berta, de Valladolid: ¿cuánto descanso entre series?' });
await como('lucas');
check(!!(await falla(() => b.insert('esencial_notas', [{ atleta_id: id.lucas, tipo: 'pregunta_directo', texto: 'Yo llevo seguimiento, pero pregunto' }]))) && (await datos.respuestasPublicas(b)).length === 0,
  'quien lleva seguimiento no manda preguntas para el directo (tiene su chat) ni ve las públicas');

console.log('\nPelayo las ve juntas, contesta y las saca en «Respuestas»');
await como('coach');
const todas = await datos.preguntasDirecto(b);
check(todas.length === 6 && todas.filter((x) => x.nombre === 'ana Prueba').length === 5 && todas.some((x) => x.nombre === 'berta Prueba') && todas.every((x) => !x.respondida_en), 'las ve todas, con quién pregunta');
const deBerta = todas.find((x) => x.nombre === 'berta Prueba');
await datos.responderPregunta(b, deBerta.id, { respuesta: 'Uno o dos minutos: lo que necesites para repetir la serie bien.', pregunta_publica: '¿Cuánto descanso entre series?', publica: true });
await datos.responderPregunta(b, n1.id, { respuesta: 'Saca cadera hacia atrás y baja el peso.', publica: false });
check(!!(await falla(() => b.update('esencial_notas', { publica: true }, { eq: { id: n1.id } }))), 'para hacerla pública hace falta la pregunta escrita por él (sin ella, la base no deja)');
await como('ana');
const pub = await datos.respuestasPublicas(b);
check(pub.length === 1 && pub[0].pregunta === '¿Cuánto descanso entre series?' && /Uno o dos minutos/.test(pub[0].respuesta) && !('atleta_id' in pub[0]) && !('texto' in pub[0]) && !JSON.stringify(pub).includes('Valladolid'),
  'Ana ve la pública: la pregunta escrita por Pelayo y su respuesta, sin quién la hizo ni lo que escribió');
const mias = await datos.notas(b, id.ana, 'pregunta_directo');
check(/Saca cadera/.test(mias.find((x) => x.id === n1.id)?.respuesta || '') && mias.find((x) => x.id === n1.id).publica === false, 'y en «Tus preguntas», la respuesta a la suya (que no es pública)');
await datos.quitarNota(b, n1.id).catch(() => {});
const sinContestar = mias.find((x) => !x.respuesta);
await datos.quitarNota(b, sinContestar.id);
const quedan = await datos.notas(b, id.ana, 'pregunta_directo');
check(quedan.some((x) => x.id === n1.id) && !quedan.some((x) => x.id === sinContestar.id) && quedan.length === 4, 'quita una sin contestar; la contestada se queda');
await como('coach');
await datos.responderPregunta(b, deBerta.id, { respuesta: '', publica: true, pregunta_publica: 'da igual' });
await como('ana');
check((await datos.respuestasPublicas(b)).length === 0, 'si Pelayo borra su respuesta, deja de ser pública');

console.log('\nEl reto de la semana: solo cifras');
await como('ana');
check((await b.rpc('esencial_equipo_semana', {})) === null, 'con menos de cinco con semana, nada');
await db.exec(superusuario);
const ej = (await db.query(`insert into ejercicios (nombre, grupos_musculares, tipo) values ('Prensa de prueba (100)', '{}', '{multiarticular}') returning id`)).rows[0].id;
const conSemana = async (atletaId, hechas, total = 2, dia = lunes) => {
  await db.query(`update atletas set estado = 'activo' where id = $1`, [atletaId]);
  const bl = (await db.query(`insert into bloques (es_plantilla, atleta_id, nombre, estado, fecha_inicio, numero) values (false, $1, 'Novato 2 días · FBE Esencial', 'activo', $2, 1) returning id`, [atletaId, dia])).rows[0].id;
  const w = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, dia])).rows[0].id;
  const out = [];
  for (let i = 1; i <= total; i++) {
    const s = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, fecha_realizada) values ($1, $2, $3, 'fuerza', $4, $5) returning id`, [w, i, `Día ${i}`, i <= hechas, i <= hechas ? sumarDias(hoy, -1) : null])).rows[0].id;
    await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, 1, 3, 10, 12)`, [s, ej]);
    out.push(s);
  }
  return out;
};
await como('coach');
const mas = [];
for (let i = 1; i <= 4; i++) mas.push((await api.crearAtletaEsencial({ nombre: `Extra ${i}`, email: `extra${i}@test`, inicio: lunes })).atleta.id);
await db.exec(superusuario);
await conSemana(id.ana, 2); await conSemana(id.berta, 1); await conSemana(mas[0], 2); await conSemana(mas[1], 0); await conSemana(mas[2], 0);
await como('ana');
check((await b.rpc('esencial_equipo_semana', {})) !== null, '(cinco con semana: ya hay cifras)');
await db.exec(superusuario);
await conSemana(mas[3], 1);
await conSemana(id.lucas, 2);   // (Lucas lleva seguimiento: no cuenta)
await como('ana');
const eq = await b.rpc('esencial_equipo_semana', {});
check(eq && eq.con === 6 && eq.completas === 2 && eq.entrenando === 4 && String(eq.lunes) === lunes && Object.keys(eq).sort().join() === 'completas,con,entrenando,lunes',
  `cuántos tienen semana, cuántos han entrenado y cuántos la han completado (${JSON.stringify(eq)}): solo cifras, sin nombres`);
await como('lucas');
check((await b.rpc('esencial_equipo_semana', {})) === null, 'quien lleva seguimiento no las ve');

console.log('\nLos avisos llevan a su explicación');
{
  await db.exec(superusuario);
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f99 = de(SQL('099_esencial_rutinas.sql')).replace(/'#hoy', 'esencial_([a-z_]+):'/g, "'#hoy/$1', 'esencial_$1:'");
  const f100 = de(SQL('100_esencial_acompanado.sql'));
  check(f100.startsWith(f99.slice(0, f99.lastIndexOf('  return v_n;'))) && f100.length > f99.length + 800 && (f100.match(/'#hoy\/[a-z_]+', 'esencial_/g) || []).length === 13 && !/'#hoy', 'esencial_/.test(f100),
    'crear_recordatorios es la de la 099 con los once avisos de FBE Esencial llevando a «#hoy/<aviso>» y dos más al final (las agujetas y «hoy toca» a su hora)');
  check(/'#atletas', 'esencial_visto_bueno:'/.test(f100), 'el del coach (un visto bueno por confirmar) sigue yendo a Atletas');
  const perfil = async (n) => (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
  const mete = async (url) => falla(async () => { await db.query(`insert into notificaciones (usuario_id, tipo, titulo, url, clave, caduca_en) values ($1, 'sesion_hoy', 'Prueba', $2, $3, now() + interval '1 hour')`, [await perfil('ana'), url, `prueba:${url}`]); });
  check(!(await mete('#hoy/retomar')) && !(await mete('#hoy/plan_auto')) && !(await mete('#hoy')) && !!(await mete('#hoy/Retomar')) && !!(await mete('#hoy/a')) && !!(await mete('#hoy/../cuenta')) && !!(await mete('#semana/lunes')),
    'un aviso puede llevar a «#hoy/<aviso>» (minúsculas y guion bajo, de 2 a 20), y a nada más raro');
  await db.query(`delete from notificaciones where clave like 'prueba:%'`);
  // Las agujetas: la mañana siguiente a su primera sesión. Ana y Berta hicieron la primera ayer; a Berta se le pone otra de hace cinco días
  for (const n of ['ana', 'berta']) await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true, silencio_desde = null, silencio_hasta = null`, [await perfil(n)]);
  await db.query(`update sesiones set fecha_realizada = $1 where id = (select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $2 and s.completada limit 1)`, [sumarDias(hoy, -5), id.berta]);
  const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec(superusuario); };
  const avisos = async (pref) => (await db.query(`select n.titulo, n.cuerpo, n.tipo, n.url, n.usuario_id from notificaciones n where n.clave like $1`, [`${pref}%`])).rows;
  await llamar(hoy, '07:30');
  check((await avisos('esencial_agujetas:')).length === 0, 'antes de su hora de la mañana, nada');
  await llamar(hoy, '08:35');
  await llamar(hoy, '08:50');
  const a = await avisos('esencial_agujetas:');
  check(a.length === 1 && a[0].usuario_id === await perfil('ana') && a[0].titulo === '¿Qué tal las agujetas?' && a[0].url === '#hoy/agujetas' && a[0].tipo === 'sesion_hoy' && a[0].cuerpo.length <= 160 && /primera sesión/.test(a[0].cuerpo),
    'la mañana siguiente a su primera sesión: «¿Qué tal las agujetas?», una vez, que lleva a su tarjeta (a Berta, que la hizo hace cinco días, no)');
  await llamar(sumarDias(hoy, 1), '08:35');
  check((await avisos('esencial_agujetas:')).length === 1, 'y al día siguiente no se repite');

  // «Hoy toca», a su hora: Ana lleva tres días entrenando sobre las 18:30; Berta, sobre las 7:30 (ya tiene el de la mañana)
  const manana = sumarDias(hoy, 1);
  const pautaDe = async (n) => (await db.query(`select x.id, s.id sesion from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $1 order by s.orden limit 1`, [id[n]])).rows[0];
  for (const [n, hora] of [['ana', '18:30'], ['berta', '07:30']]) {
    const pa = await pautaDe(n);
    const mas = [];
    for (let k = 0; k < 2; k++) mas.push((await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, $3, 3, 10, 12) returning id`, [pa.sesion, ej, 5 + k])).rows[0].id);
    for (const [k, px] of [pa.id, ...mas].entries()) await db.query(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, registrada_en) values ($1, $2, 1, 40, 10, ($3::date + $4::time) at time zone 'Europe/Madrid')`, [px, id[n], sumarDias(hoy, -1 - 2 * k), hora]);
    // (mañana tienen sesión, con su día puesto)
    await db.query(`update sesiones set completada = false, fecha_realizada = null, dia_previsto = $1 where id = (select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques b on b.id = w.bloque_id where b.atleta_id = $2 order by s.orden desc limit 1)`, [manana, id[n]]);
  }
  await llamar(manana, '16:30');
  check((await avisos('esencial_hora:')).length === 0, 'dos horas antes de su hora de siempre, nada');
  await llamar(manana, '17:20');
  await llamar(manana, '17:40');
  let ah = await avisos('esencial_hora:');
  check(ah.length === 1 && ah[0].usuario_id === await perfil('ana') && ah[0].titulo === 'En un rato, tu sesión' && /Hoy toca «Día 2»/.test(ah[0].cuerpo) && ah[0].url === '#hoy/hora' && ah[0].cuerpo.length <= 160,
    'a quien suele entrenar por la tarde (Ana, sobre las 18:30): «En un rato, tu sesión», una vez, un rato antes; a Berta, que entrena a las 7:30, no (ya tiene el de la mañana)');
  await db.query(`delete from notificaciones where clave like 'esencial_hora:%'`);
  await db.query(`update sesiones set completada = true, fecha_realizada = $1 where dia_previsto = $1`, [manana]);
  await llamar(manana, '17:45');
  check((await avisos('esencial_hora:')).length === 0, 'y si ya ha entrenado, calla');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
