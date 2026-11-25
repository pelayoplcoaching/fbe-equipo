// FBE Esencial, migración 096, contra el esquema real (PGlite, con RLS): la plantilla «Novato 3 días» igual que NOVATO_3,
// pedir tres días (solo quien va por su cuenta, solo lo suyo y desde la semana 5) y la semana siguiente con el cambio (un
// bloque nuevo de tres sesiones con los kilos que llevaba; el día de alternativas sin kilos; la plancha hasta 20 kg).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';
import { filasNovato3, NOMBRE_NOVATO_3 } from '../web/src/logica/esencial-plantilla.js';

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
const superusuario = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;

const SQL = (n) => readFileSync(new URL(`../supabase/migraciones/${n}`, import.meta.url), 'utf8');
// La biblioteca con los nombres de antes (como la de Pelayo); de la 091 a la 096 otra vez encima
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
for (const m of ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql', '094_esencial_piloto.sql', '095_esencial_cuestionario.sql', '096_esencial_dias.sql']) await db.exec(SQL(m));

console.log('La plantilla «Novato 3 días · FBE Esencial»');
await db.exec(superusuario);
const filas = (await db.query(`select s.orden so, s.nombre sn, x.orden xo, e.nombre ej, x.series, x.reps_min, x.reps_max, x.rir_objetivo rir, x.descanso_seg d, x.prioridad, x.notas_coach nota
  from bloques b join semanas w on w.bloque_id = b.id join sesiones s on s.semana_id = w.id join sesion_ejercicios x on x.sesion_id = s.id join ejercicios e on e.id = x.ejercicio_id
  where b.es_plantilla and b.nombre = $1 order by s.orden, x.orden`, [NOMBRE_NOVATO_3])).rows;
const js = filasNovato3()[0].sesiones.flatMap((s) => s.ejercicios.map((e) => ({ so: s.orden, sn: s.nombre, xo: e.orden, ej: e.nombre, series: e.series, reps_min: e.reps_min, reps_max: e.reps_max,
  rir: e.rir_objetivo, d: e.descanso_seg, prioridad: e.prioridad, nota: e.notas_coach })));
const igual = filas.length === js.length && filas.every((f, i) => Object.keys(js[i]).every((k) => String(f[k] ?? '') === String(js[i][k] ?? '') || Number(f[k]) === Number(js[i][k])));
check(igual && filas.length === 15, `tres días de cinco ejercicios, igual que NOVATO_3 de la app (${filas.length} filas)`);
check(filas.filter((f) => f.so === 2).map((f) => f.ej).join(', ') === 'Sentadilla a un banco, Puente de glúteo, Flexiones, Remo en máquina, Curl de bíceps con mancuernas', 'el día 2, sus alternativas');

// El coach da de alta a Elena (empezó hace 4 semanas) y a Rosa (empieza esta semana)
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
await api.esencialAsignarPlan();
console.log('\nPedir tres días');
check(/semana 5/.test((await falla(() => api.esencialCambiarDias(3)))?.message || ''), 'durante «Primeras 4 semanas», aún no: «desde la semana 5»');
const elena = await entrar('elena@test', altaE.codigo);
await api.guardarCuestionario(elena, limpio, { completar: true });
const planE = await api.esencialAsignarPlan();
// (empezó hace cuatro semanas: su plan, cuatro semanas antes; sus cuatro semanas, hechas, con los kilos de la 4)
await db.exec(superusuario);
await db.query('update semanas set fecha_inicio = fecha_inicio - 28 where bloque_id = $1', [planE.bloque]);
await db.query('update bloques set fecha_inicio = fecha_inicio - 28, fecha_fin = fecha_fin - 28 where id = $1', [planE.bloque]);
await db.query(`update sesiones set completada = true, fecha_realizada = $1 where semana_id in (select id from semanas where bloque_id = $2)`, [hoy, planE.bloque]);
const p4 = (await db.query(`select x.id, x.series, e.nombre, e.por_tiempo from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join semanas w on w.id = s.semana_id join ejercicios e on e.id = x.ejercicio_id
  where w.bloque_id = $1 and w.numero = 4`, [planE.bloque])).rows;
const kg4 = { 'Prensa de piernas': 50, 'Peso muerto rumano con mancuernas': 12, 'Press de pecho en máquina': 25, 'Jalón al pecho': 30 };
for (const x of p4) for (let n = 1; n <= x.series; n++) await db.query('insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps) values ($1, $2, $3, $4, $5)', [x.id, elena, n, x.por_tiempo ? null : kg4[x.nombre], x.por_tiempo ? 45 : 12]);
await b.auth.entrar('elena@test', 'clave-elena@test');
const r5 = await api.prepararSemanaEsencial(elena);
const bloqueDe = async () => (await q(`select b.id, b.nombre from bloques b where b.atleta_id = $1 and not b.es_plantilla and b.estado in ('activo', 'ajustado') order by b.fecha_inicio desc limit 1`, [elena]))[0];
check(r5?.tipo === 'novato' && (await bloqueDe())?.nombre === 'Novato 2 días · FBE Esencial', 'la semana 5, «Novato 2 días» (sus días de siempre)');
check(/2 o 3/.test((await falla(() => api.esencialCambiarDias(4)))?.message || ''), 'son 2 o 3 días');
check((await api.esencialCambiarDias(3)) === 3 && (await q('select esencial_dias d from atletas where id = $1', [elena]))[0].d === 3, 'Elena pide tres días: queda guardado');
await b.auth.entrar('rosa@test', 'clave-rosa@test');
check((await falla(() => api.esencialCambiarDias(3, elena)))?.code === '42501', 'Rosa no puede cambiar los días de Elena');
await b.auth.entrar('elena@test', 'clave-elena@test');

console.log('\nLa semana siguiente, con tres días');
// (su semana 5 hecha, con la plancha en 22,5 kg por un error: el cambio la deja en 20)
await db.exec(superusuario);
const b5 = (await bloqueDe()).id;
await db.query(`update sesiones set completada = true, fecha_realizada = $1 where semana_id in (select id from semanas where bloque_id = $2)`, [hoy, b5]);
await db.query(`update sesion_ejercicios set carga_sugerida_kg = 22.5, reps_min = 35, reps_max = 45 where ejercicio_id = (select id from ejercicios where nombre = 'Plancha abdominal')
  and sesion_id in (select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1)`, [b5]);
const kg5 = Object.fromEntries((await db.query(`select e.nombre, max(x.carga_sugerida_kg) kg from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join semanas w on w.id = s.semana_id
  join ejercicios e on e.id = x.ejercicio_id where w.bloque_id = $1 group by e.nombre`, [b5])).rows.map((x) => [x.nombre, x.kg == null ? null : Number(x.kg)]));
await b.auth.entrar('elena@test', 'clave-elena@test');
const r6 = await api.prepararSemanaEsencial(elena);
const b6 = await bloqueDe();
const s6 = await q(`select s.orden, e.nombre, x.carga_sugerida_kg kg, x.reps_min, x.reps_max, w.nota_coach nota, w.fecha_inicio from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join semanas w on w.id = s.semana_id
  join ejercicios e on e.id = x.ejercicio_id where w.bloque_id = $1 order by s.orden, x.orden`, [b6.id]);
check(r6?.tipo === 'cambio' && b6.nombre === NOMBRE_NOVATO_3 && new Set(s6.map((x) => x.orden)).size === 3 && s6[0]?.fecha_inicio === sumarDias(lunesDe(hoy), 7),
  'el lunes que viene, «Novato 3 días»: un bloque nuevo con tres sesiones');
const d1 = s6.filter((x) => x.orden === 1), d2 = s6.filter((x) => x.orden === 2);
check(d1.filter((x) => x.nombre !== 'Plancha abdominal').every((x) => Number(x.kg) === kg5[x.nombre]) && s6.filter((x) => x.orden === 3).every((x, i) => Number(x.kg ?? -1) === Number(d1[i].kg ?? -1)),
  `los días 1 y 3, con los kilos que llevaba (prensa ${d1[0]?.kg} kg)`);
check(d2.every((x) => x.kg == null), 'el día 2, sin kilos (busca el peso con el que te sobren 2)');
const plD1 = d1.find((x) => x.nombre === 'Plancha abdominal');
check(Number(plD1?.kg) === 20 && plD1.reps_min === 35 && plD1.reps_max === 45, `la plancha sigue en sus segundos y, como mucho, 20 kg (${plD1?.reps_min}-${plD1?.reps_max} s, ${plD1?.kg} kg)`);
check(/tres días/.test(s6[0]?.nota || ''), 'con la nota de la plantilla');
const w5 = (await q('select id from semanas where bloque_id = $1', [b5]))[0].id;
const w6 = (await q('select id from semanas where bloque_id = $1', [b6.id]))[0].id;
const otra = await b.rpc('esencial_semana_siguiente', { p: { base: w5, inicio: sumarDias(lunesDe(hoy), 7), cambio: true } }).catch((e) => ({ error: e.message }));
check(otra === w6 && (await q(`select count(*)::int n from bloques where atleta_id = $1 and not es_plantilla`, [elena]))[0].n === 3, 'pedirla otra vez para el mismo lunes devuelve la que ya hay (no hace otro bloque)');
check((await api.esencialCambiarDias(2)) === 2, 'y puede volver a dos (desde la semana siguiente)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
