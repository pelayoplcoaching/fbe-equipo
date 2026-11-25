// FBE Esencial, migración 092 (la semana siguiente de quien va por su cuenta, sola), contra el esquema real (PGlite, con
// RLS): la plantilla de novato igual que la de la app; tras la semana de marcas, el bloque de novato con los kilos de sus
// marcas; después, la semana siguiente con lo del motor dentro de los topes; una por semana; solo la suya. Y el camino
// entero de la app (api.prepararSemanaEsencial: el motor en su móvil y la base lo guarda).
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';
import { filasPrimeras4, NOVATO_2 } from '../web/src/logica/esencial-plantilla.js';

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
const SQL_091 = readFileSync(new URL('../supabase/migraciones/091_esencial_alta.sql', import.meta.url), 'utf8');
const SQL_092 = readFileSync(new URL('../supabase/migraciones/092_esencial_semana.sql', import.meta.url), 'utf8');

// La biblioteca con los nombres de antes (como la de Pelayo); la 091 y la 092 otra vez encima (crean las plantillas)
const ids = {};
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) ids[n] = (await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}') returning id`, [n]))[0].id;
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
await db.exec(SQL_091);
await db.exec(SQL_092);

console.log('La plantilla «Novato 2 días · FBE Esencial», igual que la de la app');
const pl = await q(`select * from bloques where es_plantilla and nombre = 'Novato 2 días · FBE Esencial'`);
const pautasPl = await q(`select s.orden sesion, p.orden, e.nombre ejercicio, p.prioridad, p.series, p.reps_min, p.reps_max, p.rir_objetivo, p.descanso_seg, p.notas_coach
  from semanas w join sesiones s on s.semana_id = w.id join sesion_ejercicios p on p.sesion_id = s.id join ejercicios e on e.id = p.ejercicio_id where w.bloque_id = $1 order by s.orden, p.orden`, [pl[0]?.id]);
const esperado = filasPrimeras4(NOVATO_2)[0].sesiones.flatMap((s) => s.ejercicios.map((e) => [s.orden, e.orden, e.nombre, e.prioridad, e.series, e.reps_min, e.reps_max, e.rir_objetivo, e.descanso_seg, e.notas_coach].join('|')));
check(pl.length === 1 && pautasPl.map((x) => [x.sesion, x.orden, x.ejercicio, x.prioridad, x.series, x.reps_min, x.reps_max, x.rir_objetivo == null ? null : Number(x.rir_objetivo), x.descanso_seg, x.notas_coach].join('|')).join('\n') === esperado.join('\n'),
  `una semana, dos días, cada pauta igual que NOVATO_2 (${pautasPl.length} de ${esperado.length})`);
await db.exec('reset role;');
await db.exec(SQL_092.replace(/if v > 92 then/, 'if v > 999 then'));
check((await q(`select count(*)::int n from bloques where es_plantilla and nombre = 'Novato 2 días · FBE Esencial'`))[0].n === 1, 'repetir la migración no la duplica');

// El coach da de alta a dos atletas de FBE Esencial y a uno con seguimiento; Elena empezó hace 4 semanas
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const inicio = sumarDias(lunesDe(hoy), -28);
const alta = await api.crearAtletaEsencial({ nombre: 'Elena Mar', email: 'elena@test', inicio: lunesDe(hoy) });
const otra = await api.crearAtletaEsencial({ nombre: 'Rosa Pi', email: 'rosa@test' });
const entrar = async (email, codigo) => {
  await b.auth.registrar(email, `clave-${email}`, email.split('@')[0]);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  return (await q('select id from atletas where email = $1', [email]))[0].id;
};
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas', 'mancuernas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const elena = await entrar('elena@test', alta.codigo);
await api.guardarCuestionario(elena, limpio, { completar: true });
const r1 = await api.esencialAsignarPlan();
// (su plan empezó hace 4 semanas: se mueve en la base, como si ya las hubiera hecho)
await db.exec('reset role;');
await db.query(`update bloques set fecha_inicio = $1, fecha_fin = $2 where id = $3`, [inicio, sumarDias(inicio, 27), r1.bloque]);
await db.query(`update semanas set fecha_inicio = $1::date + (numero - 1) * 7 where bloque_id = $2`, [inicio, r1.bloque]);
// Lo que hizo: las cuatro semanas, con la semana 4 (la de marcas) a 85 kg × 12 en la prensa, etc.
const KG = { 'Prensa de piernas': 85, 'Peso muerto rumano con mancuernas': 16, 'Press de pecho en máquina': 35, 'Jalón al pecho': 40, 'Plancha abdominal': null };
const pautasE = (await db.query(`select p.id, p.series, p.orden, w.numero semana, s.id sesion, e.nombre from sesion_ejercicios p join sesiones s on s.id = p.sesion_id join semanas w on w.id = s.semana_id
  join ejercicios e on e.id = p.ejercicio_id where w.bloque_id = $1`, [r1.bloque])).rows;
for (const p of pautasE) {
  for (let n = 1; n <= p.series; n++) {
    const kg = KG[p.nombre] == null ? null : KG[p.nombre] - (4 - p.semana) * 5;
    await db.query(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $2, $3, $4, $5, $6)`, [p.id, elena, n, kg, kg == null ? 40 : 12, kg == null ? null : 7.5]);
  }
}
// (cada semana, el jueves y el domingo: así, entre el último entreno y cualquier día de esta semana hay menos de diez días y
// el motor no lo trata como una vuelta tras un parón; con todo el lunes, de jueves a domingo la prueba fallaba)
await db.query(`update sesiones set completada = true, fecha_realizada = w.fecha_inicio + case when sesiones.orden = 1 then 3 else 6 end from semanas w where w.id = sesiones.semana_id and w.bloque_id = $1`, [r1.bloque]);
await b.auth.entrar('elena@test', 'clave-elena@test');

console.log('\nTras la semana de marcas: el bloque de novato');
const sem4 = (await q(`select * from semanas where bloque_id = $1 and numero = 4`, [r1.bloque]))[0];
check(!!(await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: sem4.id, inicio: sumarDias(lunesDe(hoy), 14), novato: true, sesiones: [] } }))), 'un lunes demasiado lejano, no');
check(!!(await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: sem4.id, inicio: sumarDias(lunesDe(hoy), 2), novato: true, sesiones: [] } }))), 'un día que no es lunes, no');
const prep = await api.prepararSemanaEsencial(elena);
const nuevo = (await q(`select * from bloques where atleta_id = $1 and nombre = 'Novato 2 días · FBE Esencial'`, [elena]))[0];
const viejo = (await q(`select estado from bloques where id = $1`, [r1.bloque]))[0];
check(prep?.tipo === 'novato' && nuevo?.estado === 'activo' && nuevo.fecha_inicio === lunesDe(hoy) && viejo.estado === 'finalizado',
  `la app prepara el bloque de novato desde este lunes (${lunesDe(hoy)}); «Primeras 4 semanas», finalizado`);
const p5 = await q(`select e.nombre, p.series, p.reps_min, p.reps_max, p.rir_objetivo, p.carga_sugerida_kg kg, s.orden sesion from sesion_ejercicios p join sesiones s on s.id = p.sesion_id
  join semanas w on w.id = s.semana_id join ejercicios e on e.id = p.ejercicio_id where w.bloque_id = $1 order by s.orden, p.orden`, [nuevo?.id]);
const w5 = (await q('select * from semanas where bloque_id = $1', [nuevo?.id]))[0];
check(p5.length === 10 && p5.filter((x) => x.sesion === 1).map((x) => x.series).join() === '3,3,3,3,2' && p5.every((x) => x.nombre !== 'Plancha abdominal' || (x.reps_min === 40 && x.reps_max === 50)),
  'con la plantilla: tres series en los cuatro primeros, la plancha 40-50 s');
check(p5.filter((x) => x.nombre === 'Prensa de piernas').every((x) => Number(x.kg) >= 85 && Number(x.kg) <= 87.5) && p5.filter((x) => x.nombre === 'Plancha abdominal').every((x) => x.kg == null),
  `y los kilos de partida, de sus marcas (prensa: ${p5.find((x) => x.nombre === 'Prensa de piernas')?.kg} kg)`);
check(w5?.programacion === 'programada' && w5.numero === 1 && /Tu plan desde ahora/.test(w5.nota_coach || ''), 'publicada, con la nota de la plantilla');
check((await api.prepararSemanaEsencial(elena)) === null, 'otra vez, nada (ya está)');
const otraVez = await b.rpc('esencial_semana_siguiente', { p: { base: sem4.id, inicio: lunesDe(hoy), novato: true, sesiones: [] } });
check(otraVez === w5.id && (await q(`select count(*)::int n from bloques where atleta_id = $1 and nombre = 'Novato 2 días · FBE Esencial'`, [elena]))[0].n === 1, 'y la función, con el mismo lunes, devuelve la misma (una por semana)');

console.log('\nLa semana siguiente, con los topes');
await db.exec('reset role;');
await db.query(`update sesiones set completada = true, fecha_realizada = $2 where semana_id = $1`, [w5.id, hoy]);
const pp5 = (await db.query(`select p.id, p.series, p.ejercicio_id, s.orden sesion, p.orden from sesion_ejercicios p join sesiones s on s.id = p.sesion_id where s.semana_id = $1`, [w5.id])).rows;
for (const p of pp5) for (let n = 1; n <= p.series; n++) await db.query(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $2, $3, (select carga_sugerida_kg from sesion_ejercicios where id = $1), 12, 7)`, [p.id, elena, n]);
await b.auth.entrar('elena@test', 'clave-elena@test');
const prensa = pp5.find((x) => x.sesion === 1 && x.orden === 1);
const mucho = await b.rpc('esencial_semana_siguiente', { p: { base: w5.id, inicio: sumarDias(lunesDe(hoy), 7), sesiones: [{ orden: 1, pautas: [{ ejercicio_id: prensa.ejercicio_id, orden: 1, series: 3, reps_min: 10, reps_max: 12, carga_sugerida_kg: 300 }] }] } });
const w6 = (await q('select * from semanas where id = $1', [mucho]))[0];
const prensa6 = (await q(`select p.carga_sugerida_kg kg, p.series from sesion_ejercicios p join sesiones s on s.id = p.sesion_id where s.semana_id = $1 and s.orden = 1 and p.orden = 1`, [mucho]))[0];
check(w6?.numero === 2 && w6.bloque_id === nuevo.id && Number(prensa6?.kg) <= 87.5 + 0.01, `300 kg en la prensa se sale de los topes: se queda lo de la semana anterior (${prensa6?.kg} kg)`);
check((await q('select fecha_fin from bloques where id = $1', [nuevo.id]))[0].fecha_fin === sumarDias(lunesDe(hoy), 13), 'el bloque crece una semana');

console.log('\nLa plancha: hasta 60 s y, con peso, 5 kg más como mucho sobre lo que ha hecho');
const planchaDe = (semana) => q(`select s.orden sesion, p.reps_min, p.reps_max, p.carga_sugerida_kg kg from sesion_ejercicios p join sesiones s on s.id = p.sesion_id
  join ejercicios e on e.id = p.ejercicio_id where s.semana_id = $1 and e.nombre = 'Plancha abdominal' order by s.orden`, [semana]);
const idPl = ids['Plancha abdominal'];
const pl6a = await planchaDe(mucho);
check(pl6a.length === 2 && pl6a.every((x) => x.reps_min === 40 && x.reps_max === 50 && x.kg == null), 'sin nada de la app para la plancha, la del molde (40-50 s, sin peso)');
// (otra vez la semana 6, ahora con la plancha: se borra la de antes)
const otraSemana6 = async (pautasPlancha) => {
  await db.exec('reset role;');
  await db.query('delete from semanas where bloque_id = $1 and numero = 2', [nuevo.id]);
  await b.auth.entrar('elena@test', 'clave-elena@test');
  const id = await b.rpc('esencial_semana_siguiente', { p: { base: w5.id, inicio: sumarDias(lunesDe(hoy), 7), sesiones: pautasPlancha.map((x, i) => ({ orden: i + 1, pautas: [{ ejercicio_id: idPl, orden: 5, series: 2, ...x }] })) } });
  return planchaDe(id);
};
const pl6b = await otraSemana6([{ reps_min: 35, reps_max: 45, carga_sugerida_kg: 5 }, { reps_min: 35, reps_max: 45, carga_sugerida_kg: 6 }]);
check(Number(pl6b[0]?.kg) === 5 && pl6b[0].reps_min === 35 && pl6b[0].reps_max === 45, 'con 5 kg y 35-45 s (su primer peso), sí');
check(pl6b[1]?.kg == null && pl6b[1].reps_max === 50, 'con 6 kg (más de 5 sobre lo que ha hecho, que fue sin peso), no: la del molde');
const pl6c = await otraSemana6([{ reps_min: 50, reps_max: 60 }, { reps_min: 51, reps_max: 61 }]);
check(pl6c[0]?.reps_max === 60 && pl6c[1]?.reps_max === 50 && pl6c[1].reps_min === 40, 'hasta 60 s, sí; 61, no (la del molde)');

console.log('\nSolo la suya');
const rosa = await entrar('rosa@test', otra.codigo);
check(/no es tuya|42501/.test((await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: w5.id, inicio: sumarDias(lunesDe(hoy), 14), sesiones: [] } })))?.message || ''), 'Rosa no prepara la semana de Elena');
check(!!rosa, '(fin)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
