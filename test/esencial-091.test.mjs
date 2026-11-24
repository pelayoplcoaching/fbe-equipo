// FBE Esencial, migración 091 (el alta de quien va por su cuenta), contra el esquema real (PGlite, con RLS): los nombres de
// la guía, la plantilla «Primeras 4 semanas» igual que la guía, el plan según el cuestionario desde su lunes, el visto
// bueno médico, y que a quien lleva seguimiento no le cambia nada. Sin la 091, la app lo dice sin romperse.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';
import { filasPrimeras4 } from '../web/src/logica/esencial-plantilla.js';
import { plantillaEsencial } from '../web/src/logica/esencial-alta.js';

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

// La biblioteca con los nombres de antes (como la de Pelayo) y una plantilla de 2 días; la 091 otra vez encima
const ej = async (nombre, tipo = ['multiarticular']) => (await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', $2) returning id`, [nombre, tipo]))[0].id;
const ids = {};
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal', 'Plancha lateral', 'Plancha con toque de hombros']) ids[n] = await ej(n);
const pl2 = (await q(`insert into bloques (atleta_id, es_plantilla, nombre) values (null, true, '2 días · Full body · B · Máquinas y mancuernas') returning id`))[0].id;
const w2 = (await q(`insert into semanas (bloque_id, numero) values ($1, 1) returning id`, [pl2]))[0].id;
for (const o of [1, 2]) {
  const s = (await q(`insert into sesiones (semana_id, orden, nombre) values ($1, $2, $3) returning id`, [w2, o, `Full body ${o}`]))[0].id;
  await q(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, 1, 3, 8, 10)`, [s, ids['Prensa (miscelánea)']]);
}
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
await db.exec(SQL_091);

console.log('La biblioteca, con los nombres de la guía');
const nombres = new Set((await q('select nombre from ejercicios')).map((x) => x.nombre));
check(['Prensa de piernas', 'Press de pecho en máquina', 'Jalón al pecho', 'Remo en máquina', 'Sentadilla a un banco'].every((n) => nombres.has(n))
  && !nombres.has('Prensa (miscelánea)') && !nombres.has('Jalón al pecho en máquina') && nombres.has('Curl de bíceps con mancuernas'),
  'cuatro renombrados (el mismo ejercicio, su historial no cambia), «Sentadilla a un banco» nueva y el curl, igual');
const fila = async (n) => (await q('select * from ejercicios where nombre = $1', [n]))[0];
check((await fila('Prensa de piernas')).id === ids['Prensa (miscelánea)'] && (await fila('Prensa de piernas')).alternativas[0] === (await fila('Sentadilla a un banco')).id
  && (await fila('Plancha abdominal')).alternativas[0] === ids['Curl de bíceps con mancuernas'], 'cada uno con la alternativa de la guía, la primera');
check((await fila('Plancha abdominal')).por_tiempo && (await fila('Plancha lateral')).por_tiempo && !(await fila('Plancha con toque de hombros')).por_tiempo && !(await fila('Prensa de piernas')).por_tiempo,
  'la plancha (y la lateral) van por tiempo; la de toques de hombro, no');

console.log('\nLa plantilla «Primeras 4 semanas», igual que la guía');
const pl = (await q(`select * from bloques where es_plantilla and nombre = 'Primeras 4 semanas'`));
const semanas = pl.length ? await q('select * from semanas where bloque_id = $1 order by numero', [pl[0].id]) : [];
const pautas = await q(`select w.numero semana, s.orden sesion, s.nombre nombre_sesion, p.orden, e.nombre ejercicio, p.prioridad, p.series, p.reps_min, p.reps_max, p.rir_objetivo, p.descanso_seg, p.notas_coach
  from semanas w join sesiones s on s.semana_id = w.id join sesion_ejercicios p on p.sesion_id = s.id join ejercicios e on e.id = p.ejercicio_id
  where w.bloque_id = $1 order by w.numero, s.orden, p.orden`, [pl[0]?.id]);
const esperado = filasPrimeras4().flatMap((w) => w.sesiones.flatMap((s) => s.ejercicios.map((e) => [w.numero, s.orden, s.nombre, e.orden, e.nombre, e.prioridad, e.series, e.reps_min, e.reps_max, e.rir_objetivo, e.descanso_seg, e.notas_coach].join('|'))));
const hay = pautas.map((x) => [x.semana, x.sesion, x.nombre_sesion, x.orden, x.ejercicio, x.prioridad, x.series, x.reps_min, x.reps_max, x.rir_objetivo, x.descanso_seg, x.notas_coach].join('|'));
check(pl.length === 1 && semanas.length === 4 && semanas.map((w) => w.marcas).join() === 'false,false,false,true' && semanas[0].nota_coach === filasPrimeras4()[0].nota,
  'una plantilla de 4 semanas, la cuarta con las marcas y la nota de cada semana');
check(hay.length === 40 && hay.join('\n') === esperado.join('\n'), `cada pauta, igual que la guía (${hay.length} de ${esperado.length})`);
await db.exec('reset role;');
await db.exec(SQL_091.replace(/if v > 91 then/, 'if v > 999 then'));
check((await q(`select count(*)::int n from bloques where es_plantilla and nombre = 'Primeras 4 semanas'`))[0].n === 1, 'repetir la migración no la duplica');

console.log('\nEl alta y su plan');
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const inicio = sumarDias(lunesDe(hoy), 14);
const alta = await api.crearAtletaEsencial({ nombre: 'Elena Mar', email: 'elena@test', inicio });
check(alta.atleta?.modalidad === 'por_su_cuenta' && /^FBE-/.test(alta.codigo || '') && (await q('select modalidad, esencial_inicio, nivel from atletas where id = $1', [alta.atleta.id]))[0].esencial_inicio === inicio,
  'el coach la da de alta: por su cuenta, con su lunes de inicio y su código');
check(/lunes/.test((await falla(() => api.crearAtletaEsencial({ nombre: 'X', inicio: sumarDias(inicio, 2) })))?.message || ''), 'la fecha de inicio, un lunes');
const seguida = await api.crearAtleta({ nombre: 'Pablo Ríos', email: 'pablo@test' });
const coachId = b.auth.sesion().user.id;
const otra = await api.crearAtletaEsencial({ nombre: 'Rosa Pi', email: 'rosa@test' });
const vet = await api.crearAtletaEsencial({ nombre: 'Juan Gil', email: 'juan@test' });

const entrar = async (email, codigo, cuestionario) => {
  await b.auth.registrar(email, `clave-${email}`, email.split('@')[0]);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  const yo = (await q('select id from atletas where email = $1', [email]))[0].id;
  if (cuestionario) await api.guardarCuestionario(yo, cuestionario, { completar: true });
  return yo;
};
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas', 'mancuernas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const elena = await entrar('elena@test', alta.codigo, limpio);
check(/no puede|42501|tu propio/i.test((await falla(() => api.esencialAsignarPlan(seguida.id)))?.message || ''), 'el atleta no pide el plan de otro');
check(!!(await falla(async () => { const r = await b.update('atletas', { modalidad: 'seguimiento' }, { eq: { id: elena } }); if (!r?.length) throw new Error('nada'); })), 'ni cambia su modalidad a mano');
const r1 = await api.esencialAsignarPlan();
const bl = (await q('select * from bloques where id = $1', [r1?.bloque]))[0];
const sw = await q('select * from semanas where bloque_id = $1 order by numero', [r1?.bloque]);
check(r1?.nuevo && r1.plantilla === 'Primeras 4 semanas' && bl?.estado === 'activo' && bl.fecha_inicio === inicio && sw.length === 4 && sw.every((w, i) => w.programacion === 'programada' && w.fecha_inicio === sumarDias(inicio, 7 * i)) && sw[3].marcas,
  `nunca ha entrenado: «Primeras 4 semanas», desde su lunes (${inicio}), publicada y con la semana de marcas`);
check((await q('select count(*)::int n from sesion_ejercicios p join sesiones s on s.id = p.sesion_id join semanas w on w.id = s.semana_id where w.bloque_id = $1', [r1?.bloque]))[0].n === 40, 'con sus 40 pautas');
const r2 = await api.esencialAsignarPlan();
check(r2?.bloque === r1?.bloque && r2.nuevo === false, 'pedirlo otra vez devuelve el mismo plan');

console.log('\nEl cribado y el visto bueno');
const rosa = await entrar('rosa@test', otra.codigo, { ...limpio, activo: false, enfermedad: true });
check(/visto bueno/.test((await falla(() => api.esencialAsignarPlan()))?.message || ''), 'con el cribado que no sale limpio, sin plan hasta el visto bueno');
const pedido = await api.esencialPedirVistoBueno();
check(!!pedido?.pedido_en && !!(await q('select visto_bueno_pedido_en from atletas where id = $1', [rosa]))[0].visto_bueno_pedido_en, 'marca que ya tiene el visto bueno');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const conf = await api.esencialConfirmarVistoBueno(rosa);
const lunesProx = (() => { const l = lunesDe(hoy); return l === hoy ? hoy : sumarDias(l, 7); })();
check(conf?.nuevo && (await q('select fecha_inicio from bloques where id = $1', [conf.bloque]))[0].fecha_inicio === lunesProx, `el coach lo confirma y empieza el próximo lunes (sin tanda: ${lunesProx})`);
check(/por su cuenta/.test((await falla(() => api.esencialAsignarPlan(seguida.id)))?.message || ''), 'a quien lleva seguimiento, nada');

console.log('\nQuien ya entrena');
const juan = await entrar('juan@test', vet.codigo, { ...limpio, experiencia: '1_3', dias_semana: 2 });
const r3 = await api.esencialAsignarPlan();
check(r3?.plantilla === '2 días · Full body · B · Máquinas y mancuernas', `con experiencia, la de sus días y su material (${r3?.plantilla})`);
check(!!juan, 'y entra como cualquiera');

console.log('\nLa serie confirmada (los frenos)');
const pauta1 = (await q(`select p.id from sesion_ejercicios p join sesiones s on s.id = p.sesion_id join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by w.numero, s.orden, p.orden limit 1`, [r3?.bloque]))[0].id;
await b.insert('series', [{ sesion_ejercicio_id: pauta1, numero: 1, kg: 6, reps: 10 }]);
const conf2 = await b.update('series', { confirmada: true }, { eq: { sesion_ejercicio_id: pauta1, numero: 1 } });
check(conf2?.[0]?.confirmada === true, 'el atleta confirma su serie');

console.log('\nLa misma plantilla en la app y en la base');
const casos = [];
for (const experiencia of ['ninguna', 'menos_1', '1_3', '3_5', 'mas_5', null]) for (const dias of [1, 2, 3, 4, 5, 6, null]) for (const lugar of ['gimnasio', 'gimnasio_basico', 'casa', 'aire_libre', null])
  for (const material of [[], ['barra', 'rack'], ['mancuernas', 'banco'], ['gomas'], null]) casos.push({ experiencia, dias_semana: dias, lugar, material });
await db.exec('reset role;');
let iguales = 0;
for (const c of casos) {
  const [x] = (await db.query('select fbe_privado.esencial_plantilla($1, $2, $3, $4) n', [c.experiencia, c.dias_semana, c.lugar, c.material])).rows;
  if (x.n === plantillaEsencial(c)) iguales++;
}
check(iguales === casos.length, `plantillaEsencial() da lo mismo que la base en ${iguales} de ${casos.length} casos`);

console.log('\nSin la 091');
await q('drop function public.esencial_asignar_plan(uuid)');
check((await crearApi(b).esencialAsignarPlan())?.falta091 === true, 'la app lo nota y no se rompe');
check(elena && rosa && coachId, '(fin)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
