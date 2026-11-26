// Motor de nutrición, migración 106, contra el esquema real (PGlite, con RLS): el historial de las revisiones
// (nutricion_revisiones: cada atleta ve las suyas y no las escribe a mano), nutricion_revision() con su reloj (28 días desde
// el último cambio o la última revisión; 14 tras «simplificar» o «faltan datos»), sus tipos y sus topes; y crear_recordatorios,
// la de la 104 sin pedir que se pese a quien tiene el SCOFF positivo y con «Tu lunes» sin las preguntas del directo apagado.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as M from '../web/src/logica/nutricion-motor.js';
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
await db.exec('delete from fbe_migraciones where numero > 106;');
await db.exec(SQL('106_nutricion_revision.sql'));
await db.exec(SQL('106_nutricion_revision.sql'));   // (se puede repetir)

console.log('La 106');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.nutricion_revision(jsonb, uuid)', 'execute') a1,
  has_function_privilege('authenticated', 'public.nutricion_revision(jsonb, uuid)', 'execute') u1,
  (select relrowsecurity from pg_class where oid = 'public.nutricion_revisiones'::regclass) rls, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && priv.rls && Number(priv.n) === 106, 'sin sesión, nada; el historial, con RLS; la base queda en la 106');
{
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f104 = de(SQL('104_esencial_comida.sql')), f106 = de(SQL('106_nutricion_revision.sql'));
  const scoff = "        -- (106) ni con el SCOFF positivo (dos «sí» o más): solo mantener y sin pedirle que se pese\n"
    + "        and (select count(*) from jsonb_each(coalesce(c.nutricion_salud -> 'scoff', '{}'::jsonb)) s where s.value = 'true'::jsonb) < 2\n";
  const directo = "                -- (106) las preguntas para el directo, solo con «El directo de dudas» encendido\n"
    + "                || case when exists (select 1 from public.esencial_ajustes x where x.clave = 'directo' and x.encendido)\n"
    + "                     then '. Preguntas nuevas para el directo: ' || c.preguntas else '' end || '.',\n";
  const antes = "                || '. Preguntas nuevas para el directo: ' || c.preguntas || '.',\n";
  check(f106.includes(scoff) && f106.includes(directo) && f106.replace(scoff, '').replace(directo, antes) === f104,
    'crear_recordatorios es la de la 104 con dos cambios: sin pedir pesarse con el SCOFF positivo y las preguntas del directo solo con el directo encendido');
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const coachPerfil = b.auth.sesion().user.id;
const alta = {};
for (const n of ['ana', 'berta', 'carla', 'dora']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: sumarDias(lunes, -14) });
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla', 'dora']) await entrar(n, alta[n].codigo);
await db.exec(superusuario);
for (const n of ['ana', 'berta', 'carla', 'dora']) {
  await db.query('update atletas set nutricion = true where id = $1', [id[n]]);
  await db.query('insert into cuestionarios (atleta_id, tca) values ($1, false) on conflict (atleta_id) do nothing', [id[n]]);
}

console.log('\nLa revisión de cada 4 semanas (nutricion_revision, con su historial)');
const D = { sexo: 'mujer', edad: 45, altura: 165, peso: 75, cintura: 88, cadera: 102, trabajo: 'sentado', pasos: 6000, dias_entreno: 3, objetivo: 'perder', tca: false,
  forma_comer: 'omnivora', tomas: 4, cocina: 'algo', come_fuera: 'algunos', bebidas_semana: 0, alimentos_si: [], alimentos_no: [], salud: null };
await como('ana');
const p0 = await b.rpc('nutricion_plan_motor', { p: D });
const rev = (p, atleta = null) => b.rpc('nutricion_revision', { p, ...(atleta ? { p_atleta: atleta } : {}) });
const sql = async (s, p = []) => { await db.exec(superusuario); const r = (await db.query(s, p)).rows; return r; };
const revs = (n) => sql('select * from nutricion_revisiones where atleta_id = $1 order by fecha, creado_en', [id[n]]);
const nPlanes = async (n) => Number((await sql('select count(*) n from planes_nutricion where atleta_id = $1', [id[n]]))[0].n);
check(/no vale/.test((await falla(() => rev({ tipo: 'otra', motivo: 'x' })))?.message || ''), 'un tipo de revisión que no existe: no');
check(await rev({ tipo: 'bien', motivo: 'Vas a buen ritmo.' }) === null && (await revs('ana')).length === 0, 'con su plan de hoy, aún no toca (y no deja nada)');
// (pasan n días: su plan y sus revisiones, n días antes)
const pasan = async (n) => {
  await sql('update planes_nutricion set desde = desde - $2::int where atleta_id = $1', [id.ana, n]);
  await sql('update nutricion_revisiones set fecha = fecha - $2::int where atleta_id = $1', [id.ana, n]);
  await como('ana');
};
await pasan(30);
const r1 = await rev({ tipo: 'simplificar', motivo: 'Estas cuatro semanas has seguido el plan 0 días de 28: no tocamos tus kcal.' });
let h = await revs('ana');
check(typeof r1 === 'string' && h.length === 1 && h[0].id === r1 && h[0].tipo === 'simplificar' && h[0].fecha === hoy && h[0].dias_cumplidos === 0
  && h[0].kcal_antes === p0.kcal && h[0].kcal_despues === p0.kcal && h[0].plan_id === null && Number(h[0].ritmo_previsto) === -0.5 && /no tocamos/.test(h[0].porque),
  'a los 30 días, «simplificar»: queda en su historial, sin cambiar el plan (sus kcal, los días que siguió el plan y su ritmo previsto)');
await como('ana');
check(await rev({ tipo: 'bien', motivo: 'x' }) === null, 'tras «simplificar», la siguiente a las 2 semanas: hoy, no');
await pasan(13);
check(await rev({ tipo: 'bien', motivo: 'x' }) === null, 'a los 13 días, tampoco');
await pasan(1);
const r2 = await rev({ tipo: 'datos', motivo: 'Faltan pesadas repartidas para saber a qué ritmo vas.' });
check(typeof r2 === 'string', 'a los 14, sí («faltan datos»)');
await pasan(13);
check(await rev({ tipo: 'bien', motivo: 'x' }) === null, 'tras «faltan datos», también 2 semanas (a los 13 días, no)');
await pasan(1);
const r3 = await rev({ tipo: 'bien', motivo: 'Vas a buen ritmo. Seguimos igual.', ritmo_real: -0.48, cintura_cambio: -0.5 });
h = await revs('ana');
const b3 = h.find((x) => x.id === r3);
check(typeof r3 === 'string' && Number(b3.ritmo_real) === -0.48 && Number(b3.cintura_cambio) === -0.5, '«bien», con su ritmo real y lo que cambió su cintura');
await pasan(27);
check(await rev({ tipo: 'bien', motivo: 'x' }) === null, 'tras «bien», 28 días (a los 27, no)');
await pasan(1);
const baja = M.macrosDelPlan({ kcal: p0.kcal - 100, proteinaG: p0.proteina_g, pesoRef: 68.1 });
const cambio = { tipo: 'baja', ...baja, motivo: 'Has seguido el plan y vas más despacio de lo previsto: bajamos un poco.', ritmo_real: -0.1, cintura_cambio: 0.5 };
const antes = (await revs('ana')).length;
check(/adherencia/.test((await falla(() => rev(cambio)))?.message || '') && (await revs('ana')).length === antes, 'a los 28, bajar sin buena adherencia: no (y no deja revisión)');
await db.exec(superusuario);
for (let i = 1; i <= 28; i++) {
  const f = sumarDias(hoy, -i);
  if (i <= 24) await db.query('insert into registros_nutricion (atleta_id, fecha, cumplido) values ($1, $2, 2) on conflict do nothing', [id.ana, f]);
  if (i % 2 === 0 || i % 7 === 1) await db.query('insert into pesos (atleta_id, fecha, kg) values ($1, $2, 75) on conflict (atleta_id, fecha) do nothing', [id.ana, f]);
}
await como('ana');
const sube = M.macrosDelPlan({ kcal: p0.kcal + 100, proteinaG: p0.proteina_g, pesoRef: 68.1 });
check(/topes/.test((await falla(() => rev({ ...cambio, ...sube })))?.message || ''), '«baja» con más kcal: no');
check(/topes/.test((await falla(() => rev({ ...cambio, tipo: 'sube' })))?.message || ''), '«sube» con menos kcal: no');
check(/no vale/.test((await falla(() => rev({ ...cambio, ritmo_real: 50 })))?.message || '') && /no vale/.test((await falla(() => rev({ ...cambio, ritmo_real: 'rápido' })))?.message || ''),
  'un ritmo imposible o que no es un número: no');
check(/topes/.test((await falla(() => rev({ ...cambio, proteina_g: cambio.proteina_g - 10, carbos_g: cambio.carbos_g + 10 })))?.message || ''), 'con otra proteína: no (como en la 105)');
const n0 = await nPlanes('ana');
const r4 = await rev(cambio);
h = await revs('ana');
const b4 = h.find((x) => x.id === r4);
const plan4 = (await sql('select id, kcal, proteina_g, mantenimiento, motivo, desde from planes_nutricion where atleta_id = $1 order by desde desc limit 1', [id.ana]))[0];
check(typeof r4 === 'string' && (await nPlanes('ana')) === n0 + 1 && plan4.desde === hoy && plan4.kcal === cambio.kcal && plan4.proteina_g === p0.proteina_g && plan4.mantenimiento === p0.mantenimiento && /despacio/.test(plan4.motivo),
  `con buena adherencia, la bajada entra: plan nuevo desde hoy (${p0.kcal} → ${plan4.kcal} kcal, la misma proteína y su mantenimiento)`);
check(b4.tipo === 'baja' && b4.plan_id === plan4.id && b4.kcal_antes === p0.kcal && b4.kcal_despues === cambio.kcal && b4.dias_cumplidos === 24 && Number(b4.ritmo_real) === -0.1,
  'y su revisión apunta al plan nuevo, con las kcal de antes y de después y los 24 días que siguió el plan');
await como('ana');
check(await rev({ tipo: 'bien', motivo: 'x' }) === null, 'la siguiente, dentro de 28 días');

console.log('\nQuién ve el historial');
await como('ana');
check((await b.select('nutricion_revisiones', {})).length === h.length, 'Ana ve sus revisiones');
check(!!(await falla(() => b.insert('nutricion_revisiones', [{ atleta_id: id.ana, tipo: 'bien' }]))), 'pero no apunta una a mano (solo con la revisión)');
check(!!(await falla(async () => { const r = await b.update('nutricion_revisiones', { tipo: 'sube' }, { eq: { id: r4 } }); if (!r?.length) throw new Error('nada'); })), 'ni la cambia');
await como('carla');
check((await b.select('nutricion_revisiones', {})).length === 0, 'Carla no ve las de Ana');
check(!!(await falla(() => rev({ tipo: 'bien', motivo: 'x' }, id.ana))), 'ni le hace la revisión a Ana');
await como('coach');
check((await b.select('nutricion_revisiones', { eq: { atleta_id: id.ana } })).length === h.length, 'Pelayo las ve');
await db.exec(superusuario);
await db.query('delete from planes_nutricion where id = $1', [plan4.id]);
check((await revs('ana')).find((x) => x.id === r4)?.plan_id === null, 'si se borra el plan, la revisión se queda (sin el plan)');

console.log('\n«¿Te pesas esta semana?» (106: tampoco con el SCOFF positivo)');
await db.exec(superusuario);
const P = {};
for (const [n, scoff] of [['berta', { control: true, domina: true }], ['dora', { control: true }]]) {
  P[n] = (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
  await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true`, [P[n]]);
  await db.query('update cuestionarios set nutricion_salud = $2 where atleta_id = $1', [id[n], JSON.stringify({ scoff })]);
  await db.query(`insert into planes_nutricion (atleta_id, desde, modo, fase, ritmo_pct, kcal, proteina_g, carbos_g, grasa_g, motivo)
    values ($1, $2, 'macros', 'mantener', 0, 1838, 130, 190, 62, 'Plan de partida, con tus datos.')`, [id[n], sumarDias(hoy, -10)]);
  await db.query('insert into pesos (atleta_id, fecha, kg) values ($1, $2, 70.2)', [id[n], sumarDias(hoy, -9)]);
}
const llamar = async (dia, h2) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h2}:00 Europe/Madrid`]); await db.exec(superusuario); };
const avisos = async (n) => (await db.query(`select titulo from notificaciones where usuario_id = $1 and clave = $2`, [P[n], `esencial_pesarse:${lunes}`])).rows;
await llamar(hoy, '09:00');
check((await avisos('dora')).length === 1 && (await avisos('dora'))[0].titulo === '¿Te pesas esta semana?', 'Dora, con un «sí» en el SCOFF: le llega');
check((await avisos('berta')).length === 0, 'Berta, con dos «sí» (SCOFF positivo): no se le pide que se pese');

console.log('\nTu lunes de FBE Esencial (106: sin las preguntas del directo si el directo está apagado)');
await db.exec(superusuario);
await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true`, [coachPerfil]);
await db.query(`insert into esencial_ajustes (clave, encendido) values ('resumen_lunes', true) on conflict (clave) do update set encendido = true`);
// (Dora tuvo semana programada la semana pasada: así hay algo que contar)
{
  const bl = (await db.query(`insert into bloques (es_plantilla, atleta_id, nombre, estado, fecha_inicio, numero) values (false, $1, 'Primeras 4 semanas', 'activo', $2, 1) returning id`, [id.dora, sumarDias(lunes, -7)])).rows[0].id;
  const w = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, sumarDias(lunes, -7)])).rows[0].id;
  await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, fecha_realizada) values ($1, 1, 'Día 1', 'fuerza', true, $2)`, [w, sumarDias(lunes, -6)]);
}
const resumen = async () => (await db.query(`select cuerpo from notificaciones where clave = $1`, [`esencial_resumen:${lunes}`])).rows;
await llamar(lunes, '08:30');
const s1 = await resumen();
check(s1.length === 1 && /^La semana pasada entrenaron \d+ de \d+\. Siete días sin entrenar: \d+\.$/.test(s1[0].cuerpo), `con el directo apagado, sin preguntas: «${s1[0]?.cuerpo}»`);
await db.query('delete from notificaciones where clave = $1', [`esencial_resumen:${lunes}`]);
await db.query(`insert into esencial_ajustes (clave, encendido) values ('directo', true) on conflict (clave) do update set encendido = true`);
await llamar(lunes, '08:30');
const s2 = await resumen();
check(s2.length === 1 && /\. Preguntas nuevas para el directo: 0\.$/.test(s2[0].cuerpo), `con el directo encendido, como antes: «${s2[0]?.cuerpo}»`);

console.log('\nLa comida en tu panel (106: los cambios de la revisión cuentan como ajustes; el SCOFF positivo, como antecedente)');
await como('coach');
const panel = await datos.comidaPanel(b);
const pa = panel.find((f) => f.atleta_id === id.ana), pb = panel.find((f) => f.atleta_id === id.berta), pd = panel.find((f) => f.atleta_id === id.dora);
check(pa?.ajustes === 1 && pa.ajustes_7 === 1, `Ana: su bajada de la revisión, un ajuste (y esta semana) (${JSON.stringify(pa && { a: pa.ajustes, a7: pa.ajustes_7 })})`);
check(pb?.tca === true && pd?.tca === false, 'Berta, con el SCOFF positivo, como con antecedente (no sale en «sin pesarse»); Dora, no');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
