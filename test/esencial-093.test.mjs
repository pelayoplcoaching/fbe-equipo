// FBE Esencial, migración 093 (la comida de quien va por su cuenta), contra el esquema real (PGlite, con RLS): el plan de
// partida de la base sale exactamente igual que el de la app (planComidaEsencial = planInicial) en miles de combinaciones;
// con antecedente de TCA, mantener; el ajuste de la semana, solo dentro de los topes y una vez por semana; solo lo suyo.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';
import { planComidaEsencial, ajusteComidaEsencial, MOTIVO_PARTIDA, MOTIVO_PARTIDA_TCA } from '../web/src/logica/esencial-nutricion.js';

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

// La biblioteca de la guía y las 091, 092 y 093 otra vez encima
for (const n of ['Prensa de piernas', 'Peso muerto rumano con mancuernas', 'Press de pecho en máquina', 'Jalón al pecho', 'Plancha abdominal', 'Sentadilla a un banco',
  'Puente de glúteo', 'Flexiones', 'Remo en máquina', 'Curl de bíceps con mancuernas']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
for (const m of ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql']) await db.exec(SQL(m));

console.log('El plan de partida de la base, igual que el de la app');
let iguales = 0, total = 0;
const distintos = [];
for (const sexo of ['mujer', 'hombre']) for (const edad of [18, 27, 39, 52, 66, 90]) for (const altura of [130, 152, 166.5, 178, 191, 220])
  for (const peso of [35, 48.3, 61.7, 74, 88.9, 103.2, 131.5, 250]) for (const actividad of [1.4, 1.55, 1.7, 1.85]) for (const objetivo of ['perder', 'mantener', 'ganar']) {
    const js = planComidaEsencial({ sexo, edad, altura, peso, actividad, objetivo, tca: false });
    const [{ r }] = (await db.query('select fbe_privado.esencial_plan_calcular($1, $2, $3, $4, $5, $6) r', [sexo, edad, altura, peso, actividad, objetivo])).rows;
    total++;
    const mismo = ['kcal', 'proteina_g', 'carbos_g', 'grasa_g', 'mantenimiento', 'basal'].every((c) => Number(r[c]) === Number(js[c])) && Number(r.ritmo_pct) === js.ritmo_pct;
    if (mismo) iguales++; else if (distintos.length < 3) distintos.push({ sexo, edad, altura, peso, actividad, objetivo, js, r });
  }
check(iguales === total, `${iguales} de ${total} combinaciones, idénticas (kcal, proteína, hidratos, grasa, mantenimiento y ritmo)${distintos.length ? ` ${JSON.stringify(distintos[0])}` : ''}`);

// El coach da de alta a dos atletas de FBE Esencial (una con nutrición y otro sin ella) y a una con seguimiento
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const conN = await api.crearAtletaEsencial({ nombre: 'Elena Mar', email: 'elena@test', nutricion: true, inicio: lunesDe(hoy) });
const sinN = await api.crearAtletaEsencial({ nombre: 'Rosa Pi', email: 'rosa@test', nutricion: false });
const entrar = async (email, codigo, { consentimiento = true } = {}) => {
  await b.auth.registrar(email, `clave-${email}`, email.split('@')[0]);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos(consentimiento ? undefined : ['privacidad']);
  return (await q('select id from atletas where email = $1', [email]))[0].id;
};
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const rosa = await entrar('rosa@test', sinN.codigo);
await api.guardarCuestionario(rosa, limpio, { completar: true });
const datos = { sexo: 'mujer', edad: 41, altura: 164, peso: 72.4, actividad: 1.4, objetivo: 'perder', tca: false };
check(/no lleva nutrición/.test((await falla(() => api.esencialPlanComida(datos)))?.message || ''), 'sin nutrición en su plan, no hay plan de comida');
const elena = await entrar('elena@test', conN.codigo);
check(/cuestionario/.test((await falla(() => api.esencialPlanComida(datos)))?.message || ''), 'antes, el cuestionario');
await api.guardarCuestionario(elena, limpio, { completar: true });

console.log('\nSu plan de partida');
check(/Revisa tus datos/.test((await falla(() => api.esencialPlanComida({ ...datos, edad: 15 })))?.message || ''), 'con 15 años, no (de 18 a 90)');
check(/Revisa tus datos/.test((await falla(() => api.esencialPlanComida({ ...datos, actividad: 2.2 })))?.message || ''), 'con un nivel de actividad que no es de la lista, no');
check(/Revisa tus datos/.test((await falla(() => b.rpc('esencial_plan_comida', { p: { ...datos, tca: undefined } })))?.message || ''), 'sin contestar la pregunta de salud, no');
const p1 = await api.esencialPlanComida(datos);
const js1 = planComidaEsencial(datos);
const fila1 = (await q('select * from planes_nutricion where atleta_id = $1', [elena]))[0];
check(p1?.kcal === js1.kcal && fila1?.kcal === js1.kcal && fila1.proteina_g === js1.proteina_g && fila1.carbos_g === js1.carbos_g && fila1.grasa_g === js1.grasa_g
  && fila1.fase === 'perder' && Number(fila1.ritmo_pct) === -0.5 && fila1.modo === 'macros' && fila1.desde === hoy && fila1.motivo === MOTIVO_PARTIDA,
  `su plan, el de la app: ${fila1?.kcal} kcal, ${fila1?.proteina_g} g de proteína, ${fila1?.carbos_g} de hidratos y ${fila1?.grasa_g} de grasa; perder, −0,5 % a la semana`);
check(Number((await q('select kg from pesos where atleta_id = $1 and fecha = $2', [elena, hoy]))[0]?.kg) === 72.4, 'y su peso de hoy, con sus pesos');
const p2 = await api.esencialPlanComida({ ...datos, tca: true, objetivo: 'perder' });
const fila2 = (await q('select * from planes_nutricion where atleta_id = $1', [elena]));
check(fila2.length === 1 && fila2[0].fase === 'mantener' && Number(fila2[0].ritmo_pct) === 0 && fila2[0].kcal === planComidaEsencial({ ...datos, tca: true }).kcal && fila2[0].motivo === MOTIVO_PARTIDA_TCA && p2.fase === 'mantener',
  'rehecho el mismo día (con antecedente de TCA y «perder»): se cambia ese plan, y es de mantener, sin déficit');
check((await q('select tca from cuestionarios where atleta_id = $1', [elena]))[0]?.tca === true, 'su respuesta queda en su cuestionario');

console.log('\nEl ajuste de la semana, con topes');
const plan = fila2[0];
const gasto = { kcal: Number(plan.kcal) + 300, fiabilidad: 'alta', margen: 80 };
check(ajusteComidaEsencial({ plan, gasto, pesoKg: 72.4, tca: true, hoy }) === null, 'la app no propone nada con un plan de menos de 7 días');
check((await api.esencialAjusteComida({ kcal: plan.kcal + 100, proteina_g: plan.proteina_g, carbos_g: plan.carbos_g + 25, grasa_g: plan.grasa_g, motivo: 'x' })) === null,
  'y la base tampoco lo guarda: aún no toca (devuelve null)');
// (su plan pasa a tener 8 días)
await db.exec('reset role;');
await db.query('update planes_nutricion set desde = $1 where id = $2', [sumarDias(hoy, -8), plan.id]);
await b.auth.entrar('elena@test', 'clave-elena@test');
const viejo = { ...plan, desde: sumarDias(hoy, -8) };
check(ajusteComidaEsencial({ plan: viejo, gasto: { ...gasto, kcal: Number(plan.kcal) - 300 }, pesoKg: 72.4, tca: true, hoy }) === null, 'con antecedente de TCA, la app no baja nunca sola');
const sube = ajusteComidaEsencial({ plan: viejo, gasto, pesoKg: 72.4, tca: true, hoy });
check(sube?.delta > 0 && /Ajuste de la semana: gastas unas/.test(sube.motivo) && /subes/.test(sube.motivo), `subir sí: ${sube?.motivo}`);
check(/topes/.test((await falla(() => api.esencialAjusteComida({ ...sube, kcal: sube.kcal - 400, carbos_g: sube.carbos_g - 100 })))?.message || ''), 'bajar (con TCA), no: se sale de los topes');
check(/topes/.test((await falla(() => api.esencialAjusteComida({ ...sube, kcal: plan.kcal + 400, carbos_g: plan.carbos_g + 100 })))?.message || ''), 'más de 300 kcal de una vez, no');
check(/topes/.test((await falla(() => api.esencialAjusteComida({ ...sube, proteina_g: plan.proteina_g + 20, kcal: sube.kcal + 80 })))?.message || ''), 'cambiar la proteína, no');
check(/topes/.test((await falla(() => api.esencialAjusteComida({ ...sube, kcal: sube.kcal + 40 })))?.message || ''), 'unas kcal que no cuadran con los macros, no');
const id = await api.esencialAjusteComida(sube);
const nuevo = (await q('select * from planes_nutricion where id = $1', [id]))[0];
check(nuevo?.desde === hoy && nuevo.kcal === sube.kcal && nuevo.proteina_g === plan.proteina_g && nuevo.fase === 'mantener' && nuevo.motivo === sube.motivo,
  `dentro de los topes, sí: plan nuevo desde hoy (${plan.kcal} → ${nuevo?.kcal} kcal), con el mismo objetivo y su motivo`);
check((await api.esencialAjusteComida(sube)) === null, 'y otra vez el mismo día, nada (una por semana)');

console.log('\nSolo lo suyo');
await b.auth.entrar('rosa@test', 'clave-rosa@test');
check(/42501|propio/.test((await falla(() => b.rpc('esencial_plan_comida', { p: datos, p_atleta: elena })))?.message || ''), 'Rosa no toca el plan de Elena');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
check(!!(await b.rpc('esencial_plan_comida', { p: { ...datos, tca: true }, p_atleta: elena }))?.id, 'el coach sí (desde la ficha de Elena)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
