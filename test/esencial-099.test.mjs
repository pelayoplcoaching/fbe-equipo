// FBE Esencial, migración 099, contra el esquema real (PGlite, con RLS): el catálogo de rutinas (esencial_catalogo), elegir
// una (esencial_elegir_rutina), la criba y la rutina elegida al asignar el plan (esencial_asignar_plan) y el cambio a la
// rutina elegida desde la semana siguiente (esencial_semana_siguiente), con «te sobran 2-3» de partida.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';
import { RUTINAS } from '../web/src/logica/esencial-catalogo.js';

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
const hoy = hoyISO(), lunes = lunesDe(hoy), proximo = sumarDias(lunes, 7);
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
const MIGS = ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql', '094_esencial_piloto.sql', '095_esencial_cuestionario.sql', '096_esencial_dias.sql', '097_esencial_alta_avisos.sql', '098_esencial_cierre.sql'];
for (const m of MIGS) await db.exec(SQL(m));
// Una plantilla de la biblioteca, como las de Pelayo: una semana, tres días, sin kilos ni esfuerzo (y la plancha, por tiempo)
const BIB = '3 días · Full body · B · Máquinas y mancuernas';
await db.exec(superusuario);
// (con los ejercicios de la plantilla de novato, con sus nombres de ahora: la prensa, el press, el jalón, el remo y la plancha)
const ejs = (await db.query(`select distinct e.id, e.nombre, coalesce(e.por_tiempo, false) t, s.orden so, x.orden xo from bloques b join semanas w on w.bloque_id = b.id join sesiones s on s.semana_id = w.id
  join sesion_ejercicios x on x.sesion_id = s.id join ejercicios e on e.id = x.ejercicio_id where b.es_plantilla and b.nombre = 'Novato 3 días · FBE Esencial' and w.numero = 1 order by s.orden, x.orden`)).rows;
const d1 = ejs.filter((e) => e.so === 1), d2 = ejs.filter((e) => e.so === 2);
const PRENSA = d1[0], PRESS = d1[1], PLANCHA = d1.find((e) => e.t) || d1[d1.length - 1], OTRO = d2.find((e) => !d1.some((x) => x.id === e.id));
const pl = (await db.query(`insert into bloques (es_plantilla, nombre, estado) values (true, $1, 'planificado') returning id`, [BIB])).rows[0].id;
const sem = (await db.query(`insert into semanas (bloque_id, numero, programacion) values ($1, 1, 'no_iniciada') returning id`, [pl])).rows[0].id;
for (const [i, lista] of [[PRENSA, PRESS, PLANCHA], [d1[2], OTRO], [PRENSA, d1[3]]].entries()) {
  const ses = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo) values ($1, $2, $3, 'fuerza') returning id`, [sem, i + 1, `Full body ${'ABC'[i]}`])).rows[0].id;
  for (const [j, e] of lista.entries()) await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max) values ($1, $2, $3, 3, 8, 12)`, [ses, e.id, j + 1]);
}
await db.exec(SQL('099_esencial_rutinas.sql'));
await db.exec(SQL('099_esencial_rutinas.sql'));   // (se puede repetir)

console.log('La 099');
await db.exec(superusuario);
const enCat = (await db.query(`select nombre from bloques where es_plantilla and esencial_catalogo order by nombre`)).rows.map((r) => r.nombre);
check(enCat.includes(BIB) && enCat.includes('Primeras 4 semanas') && enCat.includes('Novato 2 días · FBE Esencial') && enCat.includes('Novato 3 días · FBE Esencial') && enCat.every((n) => RUTINAS.some((r) => r.nombre === n)),
  `de entrada, en el catálogo: las plantillas de la base que están en la lista de la app (${enCat.length})`);
const lista = SQL('099_esencial_rutinas.sql');
check(RUTINAS.every((r) => lista.includes(`'${r.nombre.replace(/'/g, "''")}'`)), 'la lista de la migración son las 63 rutinas de la app, con su nombre exacto');
const priv = (await db.query(`select has_function_privilege('anon', 'public.esencial_catalogo()', 'execute') a, has_function_privilege('anon', 'public.esencial_elegir_rutina(text, uuid)', 'execute') e,
  has_function_privilege('authenticated', 'public.esencial_elegir_rutina(text, uuid)', 'execute') u`)).rows[0];
check(priv.a === false && priv.e === false && priv.u === true, 'sin sesión no se puede llamar a ninguna de las dos');

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = {};
for (const n of ['ana', 'berta', 'dani', 'rosa']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes });
// (Eva y Fede empiezan dentro de dos semanas: su plan aún no ha empezado)
const enDos = sumarDias(lunes, 14);
for (const n of ['eva', 'fede']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: enDos });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const base = { objetivo: 'salud', dias_semana: 3, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => b.auth.entrar(`${n}@test`, `clave-${n}@test`);
const suBloque = async (n) => { await db.exec(superusuario); return (await db.query(`select b.id, b.nombre, b.estado, to_char(b.fecha_inicio, 'YYYY-MM-DD') inicio from bloques b where b.atleta_id = $1 and not b.es_plantilla order by b.numero desc limit 1`, [id[n]])).rows[0]; };

console.log('\nEl catálogo y elegir rutina');
await entrar('berta', alta.berta.codigo);
const cat = await api.esencialCatalogo();
const ficha = cat.find((r) => r.nombre === BIB);
check(cat.length === enCat.length && ficha?.dias === 3 && ficha.sesiones.length === 3 && ficha.sesiones[0].nombre === 'Full body A' && ficha.sesiones[0].ejercicios.map((e) => e.nombre).join() === [PRENSA, PRESS, PLANCHA].map((e) => e.nombre).join()
  && ficha.sesiones[0].ejercicios[0].series === 3 && ficha.sesiones[0].ejercicios[2].por_tiempo === PLANCHA.t, 'el catálogo, para la ficha: cada rutina con sus días y sus ejercicios (series y repeticiones)');
check(/no está en el catálogo/.test((await falla(() => api.esencialElegirRutina('Una que no existe')))?.message || '') && /no está en el catálogo/.test((await falla(() => api.esencialElegirRutina('Primeras 4 semanas')))?.message || ''),
  'solo se elige una del catálogo (y «Primeras 4 semanas» no se elige: se llega a ella al empezar)');
check(!!(await falla(() => api.esencialElegirRutina(BIB, id.berta && '00000000-0000-0000-0000-000000000000'))), 'la de otro, no');
let r = await api.esencialElegirRutina(BIB);
await db.exec(superusuario);
check(r.rutina === BIB && (await db.query('select esencial_plantilla p, esencial_plantilla_en is not null e from atletas where id = $1', [id.berta])).rows[0].p === BIB, 'elegida: queda apuntada en su ficha');
await como('berta');
check(!!(await falla(() => b.update('atletas', { esencial_plantilla: 'otra' }, { eq: { id: id.berta } }).then((x) => { if (!x || !x.length) throw new Error('nada'); })))
  || (await q('select esencial_plantilla p from atletas where id = $1', [id.berta]))[0].p === BIB, 'a mano no puede cambiarla en su ficha');
await db.exec(superusuario);
await db.query(`update bloques set esencial_catalogo = false where es_plantilla and nombre = 'Novato 3 días · FBE Esencial'`);
await como('berta');
check((await api.esencialCatalogo()).length === enCat.length - 1 && /no está en el catálogo/.test((await falla(() => api.esencialElegirRutina('Novato 3 días · FBE Esencial')))?.message || ''), 'si Pelayo saca una del catálogo, ya no sale ni se puede elegir');
await entrar('lucas', codLucas);
check((await api.esencialCatalogo()).length === 0 && /por su cuenta/.test((await falla(() => api.esencialElegirRutina(BIB)))?.message || ''), 'quien lleva seguimiento no ve el catálogo ni elige');

console.log('\nAl asignar el plan: la criba y la rutina elegida');
await como('berta');
await api.guardarCuestionario(id.berta, { ...base, experiencia: '1_3', gustos: { ahora: 'si', tecnica: 'si', barra: 'no', prioridad: 'equilibrado', otro: 'no', mayor: 'no' } }, { completar: true });
r = await api.esencialAsignarPlan();
let bl = await suBloque('berta');
const pautas = (await db.query(`select e.nombre, x.rir_objetivo rir, x.carga_sugerida_kg kg from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join semanas w on w.id = s.semana_id join ejercicios e on e.id = x.ejercicio_id where w.bloque_id = $1 order by s.orden, x.orden`, [bl.id])).rows;
check(r.nuevo && bl.nombre === BIB && bl.inicio === (hoy === lunes || Number(new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7 <= 2 ? lunes : proximo) && pautas.length === 7, 'con un año o más y una rutina elegida: su plan es esa rutina');
check(pautas.filter((x) => x.nombre !== PLANCHA.nombre).every((x) => Number(x.rir) === 2.5) && (!PLANCHA.t || pautas.find((x) => x.nombre === PLANCHA.nombre).rir === null), 'las plantillas de la biblioteca no llevan esfuerzo: «te sobran 2-3» de partida (menos en la plancha, que va por tiempo)');
check((await q('select gustos from cuestionarios where atleta_id = $1', [id.berta]))[0].gustos?.prioridad === 'equilibrado', '«Tus gustos» se guardan con su cuestionario');
// Ana: menos de un año y parada → «Primeras 4 semanas», aunque haya elegido otra
await entrar('ana', alta.ana.codigo);
await api.esencialElegirRutina(BIB);
await api.guardarCuestionario(id.ana, { ...base, experiencia: 'menos_1', gustos: { ahora: 'parado', tecnica: 'algunos', prioridad: 'salud', otro: 'no', mayor: 'no' } }, { completar: true });
await api.esencialAsignarPlan();
check((await suBloque('ana')).nombre === 'Primeras 4 semanas', 'la criba: menos de un año y más de tres meses parada → «Primeras 4 semanas» (aunque hubiera elegido otra)');
// Dani: menos de un año, entrena y se maneja, sin elegir → la de su cuestionario (la que ya asignaba la app)
await entrar('dani', alta.dani.codigo);
await api.guardarCuestionario(id.dani, { ...base, experiencia: 'menos_1', gustos: { ahora: 'si', tecnica: 'si', prioridad: 'equilibrado', otro: 'no', mayor: 'no' } }, { completar: true });
await api.esencialAsignarPlan();
check((await suBloque('dani')).nombre === BIB, 'menos de un año, entrena y se maneja, sin elegir: no pasa por «Primeras 4 semanas»; la de su cuestionario');

console.log('\nAntes de empezar: si cambia de idea, su plan se rehace');
{
  const NOV2 = 'Novato 2 días · FBE Esencial';
  await entrar('eva', alta.eva.codigo);
  await api.esencialElegirRutina(BIB);
  await api.guardarCuestionario(id.eva, { ...base, experiencia: '1_3', gustos: { ahora: 'si', tecnica: 'si', barra: 'no', prioridad: 'equilibrado', otro: 'no', mayor: 'no' } }, { completar: true });
  await api.esencialAsignarPlan();
  const antes = await suBloque('eva');
  await como('eva');
  const r2 = await api.esencialElegirRutina(NOV2);
  const despues = await suBloque('eva');
  const cuantos = Number((await db.query('select count(*) n from bloques where atleta_id = $1 and not es_plantilla', [id.eva])).rows[0].n);
  check(antes.nombre === BIB && antes.inicio === enDos && r2.rehecho === true && r2.bloque === despues.id && despues.nombre === NOV2 && despues.inicio === enDos && despues.id !== antes.id && cuantos === 1,
    'su lunes no ha llegado y elige otra: el plan se rehace en el momento con ella, desde su mismo lunes (y solo tiene un plan)');
  const sueltas = Number((await db.query(`select count(*) n from notificaciones n where n.clave like 'semana:%' and n.estado = 'pendiente' and not exists (select 1 from semanas w where 'semana:' || w.id = n.clave)`)).rows[0].n);
  check(sueltas === 0, 'y no quedan avisos pendientes de las semanas del plan anterior');
  await como('eva');
  const r3 = await api.esencialElegirRutina(NOV2);
  check(!r3.rehecho && (await suBloque('eva')).id === despues.id, 'elegir la que ya lleva no rehace nada');
  // con algo ya apuntado, no se rehace: el cambio entra con la semana siguiente
  await db.exec(superusuario);
  await db.query(`update sesiones set completada = true, fecha_realizada = $2 where id = (select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 order by w.numero, s.orden limit 1)`, [despues.id, hoy]);
  await como('eva');
  const r4 = await api.esencialElegirRutina(BIB);
  check(r4.rutina === BIB && !r4.rehecho && (await suBloque('eva')).id === despues.id, 'con una sesión ya hecha no se rehace: el cambio entra con la semana siguiente');
  // quien empieza por «Primeras 4 semanas» no las cambia aunque aún no haya empezado
  await entrar('fede', alta.fede.codigo);
  await api.guardarCuestionario(id.fede, { ...base, experiencia: 'ninguna' }, { completar: true });
  await api.esencialAsignarPlan();
  const p4 = await suBloque('fede');
  await como('fede');
  const r5 = await api.esencialElegirRutina(BIB);
  check(p4.nombre === 'Primeras 4 semanas' && !r5.rehecho && (await suBloque('fede')).id === p4.id, 'quien empieza por «Primeras 4 semanas» no las cambia, aunque elija otra antes de su lunes (le queda apuntada para después)');
}

console.log('\nCambiar de rutina desde la semana siguiente');
// Rosa empieza de cero: «Primeras 4 semanas». A mitad, no se cambia; tras su semana de marcas, sí
await entrar('rosa', alta.rosa.codigo);
await api.guardarCuestionario(id.rosa, { ...base, experiencia: 'ninguna', dias_semana: 2, gustos: { prioridad: 'salud', otro: 'no', mayor: 'no' } }, { completar: true });
await api.esencialAsignarPlan();
await api.esencialElegirRutina(BIB);
const prog = await api.programa(id.rosa);
const w1 = prog.semanas[0];
// (su semana 2 ya está publicada: la base devuelve esa, sin cambiar nada; y sin ella, lo dice)
await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: w1.id, inicio: proximo, cambio: true, plantilla: BIB, sesiones: [] } }));
check((await suBloque('rosa')).nombre === 'Primeras 4 semanas', 'a mitad de «Primeras 4 semanas» no se cambia de rutina: su plan sigue igual');
await db.query(`delete from semanas where bloque_id = $1 and numero > 1`, [w1.bloque_id]);
await como('rosa');
check(/cuatro primeras semanas/.test((await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: w1.id, inicio: proximo, cambio: true, plantilla: BIB, sesiones: [] } })))?.message || ''), 'y la base lo dice: «Hasta acabar tus cuatro primeras semanas no se cambia de rutina»');
// (su semana de marcas, hecha: con 40 kg en la prensa)
await db.exec(superusuario);
await db.query(`update semanas set marcas = true where id = $1`, [w1.id]);
await db.query(`update sesion_ejercicios x set carga_sugerida_kg = 40 from sesiones s, ejercicios e where s.id = x.sesion_id and e.id = x.ejercicio_id and s.semana_id = $1 and e.id = $2`, [w1.id, PRENSA.id]);
await como('rosa');
const nueva = await b.rpc('esencial_semana_siguiente', { p: { base: w1.id, inicio: proximo, cambio: true, plantilla: BIB, sesiones: [] } });
bl = await suBloque('rosa');
const p2 = (await db.query(`select e.nombre, x.rir_objetivo rir, x.carga_sugerida_kg kg from sesion_ejercicios x join sesiones s on s.id = x.sesion_id join ejercicios e on e.id = x.ejercicio_id where s.semana_id = $1 order by s.orden, x.orden`, [nueva])).rows;
check(bl.nombre === BIB && bl.inicio === proximo && p2.length === 7 && p2.filter((x) => x.nombre === PRENSA.nombre).length === 2 && p2.filter((x) => x.nombre === PRENSA.nombre).every((x) => Number(x.kg) === 40) && p2.find((x) => x.nombre === OTRO.nombre).kg === null,
  'tras su semana de marcas: su plan pasa a la rutina elegida desde ese lunes, con sus kilos en lo que repite (y sin kilos en lo nuevo)');
check(p2.filter((x) => x.nombre !== PLANCHA.nombre).every((x) => Number(x.rir) === 2.5), 'y con «te sobran 2-3» de partida');
await como('rosa');
check(/Esa plantilla no es/.test((await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: nueva, inicio: sumarDias(proximo, 7), cambio: true, plantilla: 'Novato 2 días · FBE Esencial', sesiones: [] } })))?.message || '')
  || !!(await falla(() => b.rpc('esencial_semana_siguiente', { p: { base: nueva, inicio: sumarDias(proximo, 7), cambio: true, plantilla: 'Novato 2 días · FBE Esencial', sesiones: [] } }))), 'y no se cambia a una que no ha elegido');
r = await api.esencialElegirRutina(null);
await db.exec(superusuario);
check(r.rutina === null && (await db.query('select esencial_plantilla p from atletas where id = $1', [id.rosa])).rows[0].p === null, 'puede quitar lo elegido (sigue con la que lleva)');
await db.exec('reset role;');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
if (fallos) process.exit(1);
