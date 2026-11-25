// FBE Esencial, migración 097, contra el esquema real (PGlite, con RLS): por qué no vale un código (invitacion_estado, con
// su límite de intentos), el alta de cada uno para el panel del coach (esencial_alta_estado), el plan de quien llega tarde
// y los avisos de empezar (crear_recordatorios, la de la 095 con cuatro bloques más).
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
const hoy = hoyISO();
// La biblioteca con los nombres de antes (como la de Pelayo); de la 091 a la 097 otra vez encima (así están las plantillas)
for (const n of ['Prensa (miscelánea)', 'Press plano en máquina', 'Jalón al pecho en máquina', 'Remo en máquina (miscelánea)', 'Curl de bíceps con mancuernas',
  'Peso muerto rumano con mancuernas', 'Puente de glúteo', 'Flexiones', 'Plancha abdominal']) await q(`insert into ejercicios (nombre, grupos_musculares, tipo) values ($1, '{}', '{multiarticular}')`, [n]);
await q('delete from fbe_migraciones where numero >= 91');
await db.exec('reset role;');
for (const m of ['091_esencial_alta.sql', '092_esencial_semana.sql', '093_esencial_comida.sql', '094_esencial_piloto.sql', '095_esencial_cuestionario.sql', '096_esencial_dias.sql', '097_esencial_alta_avisos.sql']) await db.exec(SQL(m));

console.log('crear_recordatorios de la 097: la de la 095 con cuatro bloques más');
const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
const f095 = de(SQL('095_esencial_cuestionario.sql')), f097 = de(SQL('097_esencial_alta_avisos.sql'));
const corte = f095.lastIndexOf('  return v_n;');
check(f097.startsWith(f095.slice(0, corte)) && f097.endsWith('  return v_n;') && ['esencial_manana:', 'esencial_hoy:', 'esencial_empezamos:', 'esencial_visto_bueno:'].every((k) => f097.slice(corte).includes(k)),
  'empieza exactamente como la de la 095 y añade sus cuatro bloques al final, cada uno a prueba de fallos');
check((await q('select max(numero) n from fbe_migraciones'))[0].n >= 97, 'la base de prueba tiene la 097');

// El coach da de alta a cuatro de FBE Esencial que empiezan el lunes que viene y a Lucas, con seguimiento
const inicio = sumarDias(lunesDe(hoy), 7);
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
const coachId = b.auth.sesion().user.id;
await q(`update perfiles set rol = 'coach' where id = $1`, [coachId]);
const alta = {};
for (const n of ['Ana', 'Berta', 'Dani', 'Elena']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n.toLowerCase()}@test`, inicio });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const filasCoach = await b.rpc('esencial_alta_estado', {});
check(Array.isArray(filasCoach) && filasCoach.length === 4 && filasCoach.every((f) => f.invitado_en && f.caduca_en && !f.activado_en && f.inicio === inicio),
  'el panel del coach: los cuatro de FBE Esencial (Lucas no), invitados, con su código vigente y su lunes, sin cuenta aún');

console.log('\nPor qué no vale un código');
await b.auth.registrar('fran@test', 'clave-fran@test', 'Fran');
const estado = (c) => api.estadoInvitacion(c);
check((await estado(alta.Ana.codigo))?.estado === 'valido' && (await estado(alta.Ana.codigo))?.esencial === true, 'el de Ana vale (y se sabe que es de FBE Esencial)');
check((await estado(codLucas))?.estado === 'valido' && (await estado(codLucas))?.esencial === false, 'el de Lucas también, y no es de FBE Esencial');
check((await q('select count(*)::int n from intentos_invitacion'))[0].n === 0, 'mirar uno que vale no cuenta como intento');
check((await estado('FBE-AAAAA-BBBBB'))?.estado === 'no_existe', 'uno inventado: «no existe»');
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const nuevoElena = await api.crearInvitacion(alta.Elena.atleta.id);
await q(`update invitaciones set caduca_en = now() - interval '1 day' where atleta_id = $1`, [alta.Dani.atleta.id]);
await b.auth.entrar('fran@test', 'clave-fran@test');
check((await estado(alta.Elena.codigo))?.estado === 'reemplazado' && (await estado(nuevoElena))?.estado === 'valido', 'el viejo de Elena, «hay uno más nuevo»; el nuevo, vale');
check((await estado(alta.Dani.codigo))?.estado === 'caducado', 'el de Dani, pasada su fecha: «caducado»');
// (llevamos tres fallidos: con dos más, ya no deja mirar en una hora)
await estado('FBE-CCCCC-DDDDD'); await estado('FBE-EEEEE-FFFFF');
check((await estado(alta.Ana.codigo))?.estado === 'demasiados' && /Demasiados/.test((await falla(() => api.canjearCodigo(alta.Ana.codigo)))?.message || ''),
  'con 5 fallidos en una hora, «demasiados» (también para un código que vale) y el canje tampoco deja');
await b.auth.salir();
check(!!(await falla(() => b.rpc('invitacion_estado', { p_codigo: alta.Ana.codigo }))), 'sin sesión no se puede preguntar por un código');
await db.exec('reset role;');
const anon = await db.query(`select has_function_privilege('anon', 'public.invitacion_estado(text)', 'execute') a, has_function_privilege('anon', 'public.esencial_alta_estado()', 'execute') b`);
check(anon.rows[0].a === false && anon.rows[0].b === false, 'ninguna de las dos funciones nuevas se puede ejecutar sin sesión');

// Ana activa su cuenta; después, el suyo es «ya usado» para cualquier otro
const entrar = async (n) => {
  const email = `${n.toLowerCase()}@test`;
  await b.auth.registrar(email, `clave-${email}`, n);
  await api.canjearCodigo(alta[n].codigo);
  await api.darConsentimientos();
  return (await q('select id, perfil_id from atletas where email = $1', [email]))[0];
};
const ana = await entrar('Ana');
check((await estado(alta.Ana.codigo))?.estado === 'vinculada', 'con su cuenta ya vinculada, «vinculada»');
await b.auth.registrar('gema@test', 'clave-gema@test', 'Gema');
check((await estado(alta.Ana.codigo))?.estado === 'usado', 'para otra cuenta, el de Ana ya es «ya usado»');
check((await falla(() => b.rpc('esencial_alta_estado', {})))?.code === '42501', 'el panel del alta, solo el coach');

console.log('\nEl alta de cada uno, para el panel');
const berta = await entrar('Berta');
const dani = (await q(`select id from atletas where email = 'dani@test'`))[0];
await db.exec('reset role;');
await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [ana.perfil_id]);
const limpio = { objetivo: 'salud', experiencia: 'ninguna', dias_semana: 2, minutos_sesion: 45, lugar: 'gimnasio', material: ['maquinas'], activo: false, enfermedad: false, sintomas: [], otras: [], lesiones: [] };
await b.auth.entrar('ana@test', 'clave-ana@test');
await api.guardarCuestionario(ana.id, limpio, { completar: true });
const planA = await api.esencialAsignarPlan();
await b.auth.entrar('berta@test', 'clave-berta@test');
await api.guardarCuestionario(berta.id, limpio, { completar: true });
const planB = await api.esencialAsignarPlan();
await b.auth.entrar('coach@fbe.test', 'contraseña-coach');
const fila = (await api.esencialAltaEstado()).find((f) => f.atleta_id === ana.id);
check(!!fila?.activado_en && fila.email === true && fila.push === false && !!fila.cuestionario_en && fila.resultado === 'sin_valoracion' && fila.plan_inicio === inicio && !fila.primera_sesion,
  'de Ana: cuándo activó su cuenta, avisos por correo (no en el móvil), su cuestionario limpio y su plan desde su lunes; aún sin entrenar');
check(planA?.inicio === inicio && planB?.inicio === inicio, 'sus planes empiezan su lunes');

console.log('\nSi llega tarde');
// Elena tenía tanda hace dos semanas y envía hoy el cuestionario
await q('update atletas set esencial_inicio = $1 where id = $2', [sumarDias(lunesDe(hoy), -14), alta.Elena.atleta.id]);
const elena = await (async () => { await b.auth.registrar('elena@test', 'clave-elena@test', 'Elena'); await api.canjearCodigo(nuevoElena); await api.darConsentimientos(); return (await q(`select id from atletas where email = 'elena@test'`))[0]; })();
await api.guardarCuestionario(elena.id, limpio, { completar: true });
const planE = await api.esencialAsignarPlan();
const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay() || 7;
const esperado = dow <= 3 ? lunesDe(hoy) : sumarDias(lunesDe(hoy), 7);
check(planE?.inicio === esperado, `pasado su lunes: este lunes de lunes a miércoles y, desde el jueves, el siguiente (hoy, ${esperado})`);

console.log('\nLos avisos de empezar');
await db.exec('reset role;');
for (const a of [ana, berta]) await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [a.perfil_id]);
await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [coachId]);
// (Lucas, con seguimiento, también empieza un bloque ese lunes: a él, nada de esto)
await b.auth.registrar('lucas@test', 'clave-lucas@test', 'Lucas'); await api.canjearCodigo(codLucas); await api.darConsentimientos();
await db.exec('reset role;');
const lucasA = (await db.query(`select id, perfil_id from atletas where email = 'lucas@test'`)).rows[0];
await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [lucasA.perfil_id]);
await db.query(`insert into bloques (atleta_id, numero, nombre, fecha_inicio, fecha_fin, estado) values ($1, 1, 'Fuerza', $2, $3, 'activo')`, [lucasA.id, inicio, sumarDias(inicio, 27)]);
// (Berta planificó su primera sesión ese lunes: le llega «Hoy toca», no «Hoy empiezas»)
await db.query(`update sesiones set dia_previsto = $1 where id = (select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $2 and w.numero = 1 order by s.orden limit 1)`, [inicio, planB.bloque]);
const servidor = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false); set role service_role;`;
const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec('reset role;'); };
const avisos = async (pref) => (await db.query(`select n.titulo, n.cuerpo, n.tipo, n.url, n.usuario_id, n.clave from notificaciones n where n.clave like $1`, [`${pref}%`])).rows;
const quien = (rs) => rs.map((x) => (x.usuario_id === ana.perfil_id ? 'Ana' : x.usuario_id === berta.perfil_id ? 'Berta' : x.usuario_id === lucasA.perfil_id ? 'Lucas' : x.usuario_id === coachId ? 'coach' : '?')).sort().join(',');

await llamar(sumarDias(inicio, -1), '20:00');
check((await avisos('esencial_manana:')).length === 0, 'la víspera a las 20:00, aún no (va a su hora de la tarde, las 21:00)');
await llamar(sumarDias(inicio, -1), '21:30');
const m = await avisos('esencial_manana:');
check(quien(m) === 'Ana,Berta' && m.every((x) => x.titulo === 'Mañana empiezas' && x.tipo === 'sesion_hoy' && x.url === '#hoy'), `la víspera, a su hora: «Mañana empiezas» a Ana y a Berta (a Lucas, no) (${quien(m)})`);
await llamar(sumarDias(inicio, -1), '22:15');
check((await avisos('esencial_manana:')).length === 2, 'y no se repite');
await llamar(inicio, '09:00');
const h = await avisos('esencial_hoy:');
check(quien(h) === 'Ana' && h[0]?.titulo === 'Hoy empiezas', `su lunes, a su hora de la mañana: «Hoy empiezas» a Ana (${quien(h)})`);
check(quien((await avisos('recordatorio_sesion:')).filter((x) => x.usuario_id !== lucasA.perfil_id)) === 'Berta', 'a Berta le llega «Hoy toca» (planificó ese día) y no también «Hoy empiezas»');
// Berta hace una sesión el martes; Ana, ninguna
await db.query(`update sesiones set completada = true, fecha_realizada = $1 where id = (select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $2 and w.numero = 1 order by s.orden limit 1)`, [sumarDias(inicio, 1), planB.bloque]);
await llamar(sumarDias(inicio, 2), '21:30');
check((await avisos('esencial_empezamos:')).length === 0, 'el miércoles, aún no');
await llamar(sumarDias(inicio, 3), '21:30');
const e = await avisos('esencial_empezamos:');
check(quien(e) === 'Ana' && e[0]?.titulo === '¿Empezamos?', `el jueves de su semana 1, a quien no ha hecho ninguna sesión: «¿Empezamos?» a Ana (${quien(e)})`);
// (su segundo bloque, el de la semana 5, no es «empezar»)
await db.query(`insert into bloques (atleta_id, numero, nombre, fecha_inicio, fecha_fin, estado) values ($1, 2, 'Novato 2 días · FBE Esencial', $2, $3, 'planificado')`, [ana.id, sumarDias(inicio, 28), sumarDias(inicio, 34)]);
await llamar(sumarDias(inicio, 27), '21:30');
check((await avisos('esencial_manana:')).length === 2, 'la víspera de su semana 5 (otro bloque), nada: solo se empieza una vez');

console.log('\nAl coach, los vistos buenos sin confirmar');
await db.query(`update cuestionarios set resultado = 'valorar_antes' where atleta_id = $1`, [berta.id]);
await db.query(`update atletas set visto_bueno_pedido_en = now() - interval '2 days' where id = $1`, [berta.id]);
await llamar(hoy, '10:30');
check((await avisos('esencial_visto_bueno:')).length === 0, 'con 2 días, aún no');
await db.query(`update atletas set visto_bueno_pedido_en = now() - interval '4 days' where id = $1`, [berta.id]);
await llamar(hoy, '09:30');
check((await avisos('esencial_visto_bueno:')).length === 0, 'a las 9:30, aún no (por la mañana, de 10 a 12)');
await llamar(hoy, '10:30');
const v = await avisos('esencial_visto_bueno:');
check(quien(v) === 'coach' && v[0].titulo === 'Un visto bueno espera tu confirmación' && v[0].url === '#atletas' && v[0].tipo === 'cuestionario_recibido', `con 4 días, al coach: «Un visto bueno espera tu confirmación», a Atletas (${v[0]?.cuerpo})`);
await llamar(hoy, '11:30');
check((await avisos('esencial_visto_bueno:')).length === 1, 'uno al día');
void dani;

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
