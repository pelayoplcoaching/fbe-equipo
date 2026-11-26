// Motor de nutrición, migración 105, contra el esquema real (PGlite, con RLS): el cálculo de la base es el de
// logica/nutricion-motor.js (planMotor) en muchas combinaciones; nutricion_plan_motor() guarda el perfil, la salud, el
// peso, las medidas y el plan (o nada, con una exclusión); nutricion_revision() pone sus topes (28 días, adherencia, 250
// kcal, la misma proteína, la grasa, los suelos y, con antecedente de TCA, sin bajar).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as M from '../web/src/logica/nutricion-motor.js';
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
const hoy = hoyISO(), lunes = lunesDe(hoy);
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 105;');
await db.exec(SQL('105_nutricion_motor.sql'));
await db.exec(SQL('105_nutricion_motor.sql'));   // (se puede repetir)

console.log('La 105');
await db.exec(superusuario);
const priv = (await db.query(`select has_function_privilege('anon', 'public.nutricion_plan_motor(jsonb, uuid)', 'execute') a1,
  has_function_privilege('anon', 'public.nutricion_revision(jsonb, uuid)', 'execute') a2, has_function_privilege('anon', 'public.nutricion_salud_valida(jsonb)', 'execute') a3,
  has_function_privilege('authenticated', 'public.nutricion_plan_motor(jsonb, uuid)', 'execute') u1, has_function_privilege('authenticated', 'public.nutricion_salud_valida(jsonb)', 'execute') u3,
  has_function_privilege('authenticated', 'fbe_privado.nutricion_plan_calcular(jsonb)', 'execute') u4, (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && !priv.a2 && !priv.a3 && priv.u1 && priv.u3 && !priv.u4 && Number(priv.n) === 105, 'sin sesión, nada; el cálculo, solo por dentro; la base queda en la 105');

console.log('\nEl cálculo de la base es el de la app (planMotor)');
{
  let n = 0, dif = 0, ejemplo = '';
  for (const sexo of ['mujer', 'hombre']) for (const edad of [25, 45, 70]) for (const [altura, peso, cintura] of [[165, 75, 88], [180, 95, 105], [155, 52, 70], [170, 120, 120]])
    for (const trabajo of ['sentado', 'de_pie', 'fisico']) for (const objetivo of ['perder', 'mantener', 'ganar'])
      for (const extra of [{}, { ritmo_pct: -0.75, bebidas_semana: 7, tomas: 3 }, { pocos_hidratos: true, experiencia: 'novato', dias_entreno: 5, pasos: 10000 }, { ritmo_pct: -1, experiencia: 'avanzado', masa_magra: 60, solo_mantener: false }]) {
        const d = { sexo, edad, altura, peso, cintura, trabajo, objetivo, pasos: 6000, dias_entreno: 3, ...extra };
        const js = M.planMotor({ ...d, ritmo: d.ritmo_pct, diasEntreno: d.dias_entreno, pocosHidratos: d.pocos_hidratos, bebidasSemana: d.bebidas_semana, masaMagraDexa: d.masa_magra });
        const s = (await db.query('select fbe_privado.nutricion_plan_calcular($1::jsonb) as p', [JSON.stringify(d)])).rows[0].p;
        n++;
        const igual = js.kcal === s.kcal && js.proteina_g === s.proteina_g && js.grasa_g === s.grasa_g && js.carbos_g === s.carbos_g && js.mantenimiento === s.mantenimiento
          && js.ritmo_pct === s.ritmo_pct && (js.limite ?? null) === (s.limite ?? null) && js.proteinaToma_g === s.proteina_toma_g && js.formula === s.formula;
        if (!igual) { dif++; ejemplo ||= JSON.stringify({ d, js: [js.kcal, js.proteina_g, js.grasa_g, js.carbos_g], s: [s.kcal, s.proteina_g, s.grasa_g, s.carbos_g] }); }
      }
  check(n === 864 && dif === 0, `en ${n} combinaciones (sexo, edad, cuerpo, trabajo, objetivo, ritmo, alcohol, tomas, experiencia, masa magra), las mismas cifras${dif ? `: ${dif} distintas (${ejemplo})` : ''}`);
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: sumarDias(lunes, -14) });
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla']) await entrar(n, alta[n].codigo);
await db.exec(superusuario);
for (const n of ['ana', 'carla']) await db.query('update atletas set nutricion = true where id = $1', [id[n]]);
await db.query('update atletas set nutricion = false where id = $1', [id.berta]);
for (const n of ['ana', 'berta', 'carla']) await db.query('insert into cuestionarios (atleta_id, tca) values ($1, false) on conflict (atleta_id) do nothing', [id[n]]);

console.log('\nEl plan de partida (nutricion_plan_motor)');
const D = { sexo: 'mujer', edad: 45, altura: 165, peso: 75, cintura: 88, cadera: 102, trabajo: 'sentado', pasos: 6000, dias_entreno: 3, objetivo: 'perder', tca: false,
  forma_comer: 'omnivora', tomas: 4, cocina: 'algo', come_fuera: 'algunos', bebidas_semana: 0, alimentos_si: ['pollo', 'arroz'], alimentos_no: ['higado'], salud: { scoff: { control: false } } };
const rpc = (p, atleta = null) => b.rpc('nutricion_plan_motor', { p, ...(atleta ? { p_atleta: atleta } : {}) });
await como('ana');
const p1 = await rpc(D);
const js1 = M.planMotor({ ...D, diasEntreno: 3 });
check(p1?.automatico === true && p1.kcal === js1.kcal && p1.proteina_g === js1.proteina_g && p1.carbos_g === js1.carbos_g && p1.grasa_g === js1.grasa_g && p1.desde === hoy,
  `Ana: su plan, el mismo que calcula la app (${p1?.kcal} kcal, ${p1?.proteina_g} g de proteína)`);
await db.exec(superusuario);
const fila = (await db.query('select fase, ritmo_pct, kcal, mantenimiento, fibra_g, motivo from planes_nutricion where atleta_id = $1 and desde = $2', [id.ana, hoy])).rows[0];
const perfil = (await db.query('select * from nutricion_perfiles where atleta_id = $1', [id.ana])).rows[0];
const med = (await db.query('select cintura_cm, cadera_cm from medidas where atleta_id = $1 and fecha = $2', [id.ana, hoy])).rows[0];
const peso = (await db.query('select kg from pesos where atleta_id = $1 and fecha = $2', [id.ana, hoy])).rows[0];
const salud = (await db.query('select nutricion_salud, tca from cuestionarios where atleta_id = $1', [id.ana])).rows[0];
check(fila.fase === 'perder' && Number(fila.ritmo_pct) === -0.5 && fila.mantenimiento === 2160 && fila.fibra_g === 25 && /cuestionario de nutrición/.test(fila.motivo),
  'el plan guardado, con su mantenimiento (2160) para el suelo del 25 %');
check(perfil.trabajo === 'sentado' && perfil.pasos === 5000 && perfil.anio_nacimiento === Number(hoy.slice(0, 4)) - 45 && perfil.alimentos_si.join() === 'pollo,arroz' && perfil.alimentos_no.join() === 'higado',
  'su perfil de nutrición (los pasos, por su tramo; el año en que nació; sus alimentos)');
check(Number(med.cintura_cm) === 88 && Number(med.cadera_cm) === 102 && Number(peso.kg) === 75 && salud.tca === false && salud.nutricion_salud.scoff.control === false,
  'su peso y sus medidas de hoy, y lo de salud en su cuestionario');
await como('ana');
check((await b.select('nutricion_perfiles', {})).length === 1, 'Ana ve su perfil');
check(!!(await falla(async () => { const r = await b.update('nutricion_perfiles', { objetivo: 'ganar' }, { eq: { atleta_id: id.ana } }); if (!r?.length) throw new Error('nada'); })),
  'pero no lo cambia a mano (solo con su cuestionario)');
await como('carla');
check((await b.select('nutricion_perfiles', {})).length === 0, 'Carla no ve el de Ana');
check(!!(await falla(() => rpc(D, id.ana))), 'ni le calcula el plan a Ana');
await como('berta');
check(/no lleva nutrición/.test((await falla(() => rpc(D)))?.message || ''), 'Berta, sin nutrición: no');
await como('ana');
check(!!(await falla(() => rpc({ ...D, cintura: null }))) && !!(await falla(() => rpc({ ...D, trabajo: 'astronauta' }))) && !!(await falla(() => rpc({ ...D, salud: { scoff: { otra: true } } }))),
  'sin cintura, con un trabajo que no existe o con una salud mal formada: «Revisa tus datos»');
const ex = await rpc({ ...D, salud: { embarazo: true } });
await db.exec(superusuario);
const nPlanes = Number((await db.query('select count(*) n from planes_nutricion where atleta_id = $1', [id.ana])).rows[0].n);
check(ex.automatico === false && ex.motivo === 'embarazo' && nPlanes === 1, 'embarazada: sin plan automático (y su plan no cambia)');
await como('ana');
const sm = await rpc({ ...D, salud: { scoff: { control: true, domina: true } } });
check(sm.automatico && sm.objetivo === 'mantener' && sm.ritmo_pct === 0 && sm.solo_mantener === true, 'SCOFF con 2 «sí»: solo mantener');
const tc = await rpc({ ...D, tca: true });
check(tc.objetivo === 'mantener' && tc.solo_mantener === true, 'con antecedente de TCA: solo mantener');
const p2 = await rpc(D);
check(p2.objetivo === 'perder', 'y vuelve a su plan al rehacerlo sin el antecedente');

console.log('\nLa revisión de cada 4 semanas (nutricion_revision)');
const rev = (p, atleta = null) => b.rpc('nutricion_revision', { p, ...(atleta ? { p_atleta: atleta } : {}) });
const baja = M.macrosDelPlan({ kcal: p2.kcal - 100, proteinaG: p2.proteina_g, pesoRef: 68.1 });
const cambio = { ...baja, motivo: 'Has seguido el plan y vas más despacio de lo previsto: bajamos un poco.' };
check(await rev(cambio) === null, 'con su plan de hoy, aún no toca (cada 28 días)');
await db.exec(superusuario);
await db.query('update planes_nutricion set desde = $2 where atleta_id = $1', [id.ana, sumarDias(hoy, -30)]);
await como('ana');
check(/adherencia/.test((await falla(() => rev(cambio)))?.message || ''), 'sin buena adherencia (nada apuntado): no se tocan las kcal');
await db.exec(superusuario);
for (let i = 1; i <= 28; i++) {
  const f = sumarDias(hoy, -i);
  if (i <= 24) await db.query('insert into registros_nutricion (atleta_id, fecha, cumplido) values ($1, $2, 2) on conflict do nothing', [id.ana, f]);
  if (i % 2 === 0 || i % 7 === 1) await db.query('insert into pesos (atleta_id, fecha, kg) values ($1, $2, 75) on conflict (atleta_id, fecha) do nothing', [id.ana, f]);
}
await como('ana');
check(/topes/.test((await falla(() => rev({ ...cambio, proteina_g: cambio.proteina_g - 10, carbos_g: cambio.carbos_g + 10 })))?.message || ''), 'con otra proteína: no');
const mucho = M.macrosDelPlan({ kcal: p2.kcal - 300, proteinaG: p2.proteina_g, pesoRef: 68.1 });
check(/topes/.test((await falla(() => rev({ ...mucho, motivo: 'x' })))?.message || ''), 'más de 250 kcal de una vez: no');
const suelo = M.macrosDelPlan({ kcal: 1490, proteinaG: p2.proteina_g, pesoRef: 68.1 });
await db.exec(superusuario);
await db.query('update planes_nutricion set kcal = 1650, carbos_g = carbos_g - 25 where atleta_id = $1', [id.ana]);
await como('ana');
check(/topes/.test((await falla(() => rev({ ...suelo, motivo: 'x' })))?.message || ''), 'por debajo de su suelo (1620: el 75 % de 2160): no');
await db.exec(superusuario);
await db.query('update planes_nutricion set kcal = $2, carbos_g = $3 where atleta_id = $1', [id.ana, p2.kcal, p2.carbos_g]);
await db.query('update cuestionarios set tca = true where atleta_id = $1', [id.ana]);
await como('ana');
check(/topes/.test((await falla(() => rev(cambio)))?.message || ''), 'con antecedente de TCA, sin bajar');
await db.exec(superusuario);
await db.query('update cuestionarios set tca = false where atleta_id = $1', [id.ana]);
await como('ana');
const nuevo = await rev(cambio);
await db.exec(superusuario);
const ult = (await db.query('select kcal, proteina_g, mantenimiento, motivo, desde from planes_nutricion where atleta_id = $1 order by desde desc limit 1', [id.ana])).rows[0];
check(typeof nuevo === 'string' && ult.kcal === cambio.kcal && ult.proteina_g === p2.proteina_g && ult.mantenimiento === 2160 && /despacio/.test(ult.motivo) && ult.desde === hoy,
  `con buena adherencia, el cambio entra (${p2.kcal} → ${ult.kcal} kcal, la misma proteína y su mantenimiento)`);
await como('ana');
check(await rev(cambio) === null, 'y el siguiente, dentro de 28 días');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
