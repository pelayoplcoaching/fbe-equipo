// FBE Esencial, migración 094 (lo del piloto), contra el esquema real (PGlite, con RLS): la alternativa para siempre (solo
// entre las de su ejercicio y que se midan igual; cambia sus sesiones sin hacer, menos la que tiene abierta, y se deshace),
// la semana 5 con su alternativa, los avisos para un grupo y el aviso a los 7 días sin entrenar (crear_recordatorios, la de
// la 054 con un bloque más: empieza exactamente igual).
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
const hoy = hoyISO();
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
const M094 = SQL('094_esencial_piloto.sql');

console.log('crear_recordatorios de la 094: la de la 054 con un bloque más');
const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
const f054 = de(SQL('054_cierre.sql')), f094 = de(M094);
const corte = f054.lastIndexOf('  return v_n;');
check(f094.startsWith(f054.slice(0, corte)) && f094.endsWith('  return v_n;') && /esencial_retomar/.test(f094.slice(corte)) && f094.length > f054.length,
  'empieza exactamente como la de la 054 y añade su bloque al final, a prueba de fallos');

// La biblioteca con los nombres de antes (como la de Pelayo); de la 091 a la 094 otra vez encima
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
for (const m of ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql', '094_esencial_piloto.sql']) await db.exec(SQL(m));
const id = async (n) => (await q('select id from ejercicios where nombre = $1', [n]))[0].id;
const prensa = await id('Prensa de piernas'), sentadilla = await id('Sentadilla a un banco'), plancha = await id('Plancha abdominal'), curl = await id('Curl de bíceps con mancuernas');

// El coach da de alta a Elena y a Rosa (FBE Esencial)
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const altaE = await api.crearAtletaEsencial({ nombre: 'Elena Mar', email: 'elena@test', inicio: lunesDe(hoy) });
const altaR = await api.crearAtletaEsencial({ nombre: 'Rosa Pi', email: 'rosa@test', inicio: lunesDe(hoy) });
const entrar = async (email, codigo) => {
  await b.auth.registrar(email, `clave-${email}`, email.split('@')[0]);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  return (await q('select id from atletas where email = $1', [email]))[0].id;
};
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const rosa = await entrar('rosa@test', altaR.codigo);
await api.guardarCuestionario(rosa, limpio, { completar: true });
const planR = await api.esencialAsignarPlan();
const elena = await entrar('elena@test', altaE.codigo);
await api.guardarCuestionario(elena, limpio, { completar: true });
const planE = await api.esencialAsignarPlan();
const pautasDe = (bloque, ej) => q(`select p.id, w.numero semana, s.orden sesion, s.id sesion_id, p.ejercicio_id, p.carga_sugerida_kg kg from sesion_ejercicios p join sesiones s on s.id = p.sesion_id
  join semanas w on w.id = s.semana_id where w.bloque_id = $1 and p.ejercicio_id = any ($2::uuid[]) order by w.numero, s.orden`, [bloque, ej]);

console.log('\nLa alternativa para siempre');
check(/no es una alternativa/.test((await falla(() => api.esencialAlternativa(prensa, curl)))?.message || ''), 'solo entre las alternativas de su ejercicio (el curl no lo es de la prensa)');
check(/se miden igual/.test((await falla(() => api.esencialAlternativa(plancha, curl)))?.message || ''), 'la plancha (por tiempo) no se cambia para siempre por el curl: solo en cada sesión');
// (una serie apuntada en la prensa de su primera sesión; la segunda la tiene abierta)
const p0 = await pautasDe(planE.bloque, [prensa]);
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`);
await db.query('insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps) values ($1, $2, 1, 60, 12)', [p0[0].id, elena]);
await b.auth.entrar('elena@test', 'clave-elena@test');
const abierta = p0.find((x) => x.semana === 1 && x.sesion === 2).sesion_id;
const n = await api.esencialAlternativa(prensa, sentadilla, { excepto: abierta });
const p1 = await pautasDe(planE.bloque, [prensa, sentadilla]);
check(n === 6 && p1.filter((x) => x.ejercicio_id === sentadilla).length === 6 && p1.find((x) => x.semana === 1 && x.sesion === 1).ejercicio_id === prensa
  && p1.find((x) => x.semana === 1 && x.sesion === 2).ejercicio_id === prensa && p1.filter((x) => x.ejercicio_id === sentadilla).every((x) => x.kg == null),
  `cambia sus 6 sesiones sin hacer (no la que tiene una serie de prensa ni la que tiene abierta), sin kilos sugeridos (${n})`);
check(JSON.stringify((await q('select esencial_alternativas a from atletas where id = $1', [elena]))[0].a) === JSON.stringify({ [prensa]: sentadilla }), 'y queda guardada: { prensa: sentadilla a un banco }');
const vuelta = await api.esencialAlternativa(sentadilla, null);
const p2 = await pautasDe(planE.bloque, [prensa, sentadilla]);
check(vuelta === 6 && p2.every((x) => x.ejercicio_id === prensa) && JSON.stringify((await q('select esencial_alternativas a from atletas where id = $1', [elena]))[0].a) === '{}',
  'desde la alternativa, «volver»: las 6 vuelven a la prensa y se borra');
await api.esencialAlternativa(prensa, sentadilla);
await b.auth.entrar('rosa@test', 'clave-rosa@test');
check(/42501|propio/.test((await falla(() => b.rpc('esencial_alternativa', { p_ejercicio: prensa, p_alternativa: sentadilla, p_atleta: elena })))?.message || ''), 'Rosa no toca el plan de Elena');

console.log('\nLa semana 5, con su alternativa');
// (su plan empezó hace 4 semanas: se mueve en la base, como si ya las hubiera hecho, y lo apunta todo; como el servidor,
// sin sesión de nadie)
const sinSesion = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
await db.exec(sinSesion);
const inicio = sumarDias(lunesDe(hoy), -28);
await db.query('update bloques set fecha_inicio = $1, fecha_fin = $2 where id = $3', [inicio, sumarDias(inicio, 27), planE.bloque]);
await db.query('update semanas set fecha_inicio = $1::date + (numero - 1) * 7 where bloque_id = $2', [inicio, planE.bloque]);
const todas = (await db.query(`select p.id, p.series, w.numero semana, e.nombre from sesion_ejercicios p join sesiones s on s.id = p.sesion_id join semanas w on w.id = s.semana_id
  join ejercicios e on e.id = p.ejercicio_id where w.bloque_id = $1`, [planE.bloque])).rows;
for (const p of todas) {
  for (let k = 1; k <= p.series; k++) {
    if (p.id === p0[0].id && k === 1) continue;
    const kg = p.nombre === 'Plancha abdominal' ? null : p.nombre === 'Sentadilla a un banco' ? 10 + 2 * p.semana : 20 + 5 * p.semana;
    await db.query('insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $2, $3, $4, $5, $6)', [p.id, elena, k, kg, kg == null ? 40 : 12, kg == null ? null : 7.5]);
  }
}
await db.query('update sesiones set completada = true, fecha_realizada = w.fecha_inicio from semanas w where w.id = sesiones.semana_id and w.bloque_id = $1', [planE.bloque]);
await b.auth.entrar('elena@test', 'clave-elena@test');
const prep = await api.prepararSemanaEsencial(elena);
const nov = (await q(`select id from bloques where atleta_id = $1 and nombre = 'Novato 2 días · FBE Esencial'`, [elena]))[0];
const p5 = nov ? await pautasDe(nov.id, [prensa, sentadilla]) : [];
check(prep?.tipo === 'novato' && p5.length === 2 && p5.every((x) => x.ejercicio_id === sentadilla), 'el bloque de novato (que lleva prensa) sale con su sentadilla a un banco');
check(p5.every((x) => x.kg == null || (Number(x.kg) >= 18 && Number(x.kg) <= 22)), `y sin los kilos de la prensa (${p5.map((x) => x.kg).join(', ')})`);

console.log('\nAvisos para un grupo');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
await api.guardarAviso({ texto: 'Para todos' });
await api.guardarAviso({ texto: 'Solo FBE Esencial', grupo: 'esencial' });
await api.guardarAviso({ texto: 'Solo con seguimiento', grupo: 'seguimiento' });
check(!!(await falla(() => b.insert('avisos', [{ texto: 'Mal', grupo: 'esencial', atleta_id: elena, desde: hoy }]))), 'un aviso de grupo no lleva atleta (la base no lo deja)');
await b.auth.entrar('elena@test', 'clave-elena@test');
const deE = (await api.avisos(elena, hoy, { esencial: true })).map((a) => a.texto).sort().join(' | ');
check(deE === 'Para todos | Solo FBE Esencial', `Elena (FBE Esencial) ve el general y el suyo (${deE})`);
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const deS = (await api.avisos(elena, hoy, { esencial: false })).map((a) => a.texto).sort().join(' | ');
check(deS === 'Para todos | Solo con seguimiento', 'quien lleva seguimiento, el general y el de seguimiento');

console.log('\nA los 7 días sin entrenar');
// (Rosa empezó hace dos semanas y no ha entrenado; Elena acaba de entrenar. Las dos, con avisos por correo)
await db.exec('reset role;');
await db.query('update bloques set fecha_inicio = $1 where id = $2', [sumarDias(lunesDe(hoy), -14), planR.bloque]);
await db.query(`update sesiones set fecha_realizada = $1 where semana_id in (select id from semanas where bloque_id = $2)`, [hoy, planE.bloque]);
for (const a of [rosa, elena]) {
  const perfil = (await db.query('select perfil_id from atletas where id = $1', [a])).rows[0].perfil_id;
  await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [perfil]);
}
const servidor = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false); set role service_role;`;
const alas = (h) => `${hoy} ${h}:00 Europe/Madrid`;
await db.exec(servidor);
await db.query('select public.crear_recordatorios($1::timestamptz)', [alas('15:00')]);
await db.exec('reset role;');
const avisos = async () => (await db.query(`select n.titulo, a.id atleta from notificaciones n join atletas a on a.perfil_id = n.usuario_id where n.clave like 'esencial_retomar:%'`)).rows;
check((await avisos()).length === 0, 'a las tres de la tarde, nada (va a su hora de la tarde)');
await db.exec(servidor);
await db.query('select public.crear_recordatorios($1::timestamptz)', [alas('21:30')]);
await db.query('select public.crear_recordatorios($1::timestamptz)', [alas('22:00')]);
await db.exec('reset role;');
const r = await avisos();
check(r.length === 1 && r[0].atleta === rosa && r[0].titulo === 'Tu semana sigue lista', 'a su hora, a Rosa (dos semanas sin entrenar) le llega «Tu semana sigue lista», una sola vez; a Elena, que acaba de entrenar, no');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
