// FBE Esencial, migración 111 (la constancia), contra el esquema real (PGlite, con RLS): el plan B y el plan mínimo en
// esencial_notas (lo que vale y lo que no), constancia_111() y el aviso de constancia de crear_recordatorios (C4): solo con
// la clave encendida, a la hora de su plan B, uno por cada vez que se le pasan dos sesiones y como mucho 3 en 7 días.
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as cdatos from '../web/src/datos/api-constancia.js';
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

console.log('crear_recordatorios de la 111: la de la 106 con un bloque más');
const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
const f106 = de(SQL('106_nutricion_revision.sql')), f111 = de(SQL('111_constancia.sql'));
const corte = f106.lastIndexOf('  return v_n;');
check(f111.startsWith(f106.slice(0, corte)) && f111.endsWith('  return v_n;') && /esencial_constancia/.test(f111.slice(corte)) && f111.length > f106.length,
  'empieza exactamente como la de la 106 y añade su bloque al final, a prueba de fallos');

// El coach da de alta a Marta (FBE Esencial), que empieza hace tres semanas
await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const alta = await api.crearAtletaEsencial({ nombre: 'Marta Sol', email: 'marta@test', inicio: lunesDe(hoy) });
await b.auth.registrar('marta@test', 'clave-marta', 'Marta');
await api.canjearCodigo(alta.codigo);
await api.darConsentimientos();
const marta = (await q('select id from atletas where email = $1', ['marta@test']))[0].id;
// (su plan, puesto a mano en la base: un bloque activo de tres semanas con dos sesiones cada una)
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`);
const inicio = sumarDias(lunesDe(hoy), -21);
const plan = { bloque: (await db.query(`insert into bloques (atleta_id, numero, nombre, estado, fecha_inicio) values ($1, 1, 'Primeras 4 semanas', 'activo', $2) returning id`, [marta, inicio])).rows[0].id };
for (const k of [1, 2, 3, 4]) {
  const sem = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, $2, $3, 'programada') returning id`, [plan.bloque, k, sumarDias(inicio, 7 * (k - 1))])).rows[0].id;
  for (const o of [1, 2, 3]) await db.query(`insert into sesiones (semana_id, orden, nombre) values ($1, $2, $3)`, [sem, o, `Día ${o}`]);
}
await b.auth.entrar('marta@test', 'clave-marta');

console.log('\nEl plan B y el plan mínimo');
check(await cdatos.hay111(b) === true, 'constancia_111(): la base ya guarda lo de la constancia');
const pb = await cdatos.guardarPlanB(b, marta, { hora: 'manana', b: 'minima' });
check(pb?.tipo === 'plan_b' && pb.datos.hora === 'manana', 'guarda su plan B (su hora y qué hace si un día no puede)');
const pb2 = await cdatos.guardarPlanB(b, marta, { hora: 'tarde', b: 'siguiente' });
const suyos = await q(`select datos from esencial_notas where atleta_id = $1 and tipo = 'plan_b'`, [marta]);
check(pb2?.id && suyos.length === 1 && suyos[0].datos.hora === 'tarde', 'el nuevo sustituye al anterior (uno solo)');
check(!!(await falla(() => b.insert('esencial_notas', [{ atleta_id: marta, tipo: 'plan_b', datos: { hora: 'madrugada', b: 'minima' } }]))), 'una hora que no vale no entra');
const pm = await cdatos.empezarPlanMinimo(b, marta, { hoy });
check(pm?.desde === lunesDe(hoy) && pm.hasta === sumarDias(lunesDe(hoy), 13), 'el plan mínimo: del lunes de esta semana al domingo de la siguiente');
check(!!(await falla(() => b.insert('esencial_notas', [{ atleta_id: marta, tipo: 'plan_minimo', datos: {}, desde: hoy, hasta: sumarDias(hoy, 30) }]))), 'más de dos semanas no entra');
const n = await cdatos.notasConstancia(b, marta);
check(n?.planB?.b === 'siguiente' && n.planMinimo.length === 1, 'y la app los lee (su plan B y su plan mínimo)');
await cdatos.dejarPlanMinimo(b, marta, n.planMinimo[0], { hoy });
const quedan = await q(`select desde, hasta from esencial_notas where atleta_id = $1 and tipo = 'plan_minimo'`, [marta]);
check(hoy === lunesDe(hoy) ? quedan.length === 0 : (quedan.length === 1 && quedan[0].hasta === sumarDias(hoy, -1)), '«Volver a mi plan»: se acorta hasta ayer (o se quita si aún no había empezado)');

console.log('\nEl aviso de constancia (C4)');
// (su plan empezó hace tres semanas; entrenó hace 6 días y se le han pasado las dos sesiones que tenía previstas después)
const sinSesion = `reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`;
await db.exec(sinSesion);
// (cada día, en una sesión de su semana: la primera libre)
const usadas = new Set();
const sesionDelDia = async (dia) => {
  const filas = (await db.query(`select s.id from sesiones s join semanas w on w.id = s.semana_id where w.bloque_id = $1 and $2::date between w.fecha_inicio and w.fecha_inicio + 6 order by s.orden`, [plan.bloque, dia])).rows;
  const f = filas.find((x) => !usadas.has(x.id));
  usadas.add(f.id);
  return { id: f.id };
};
const hecha = await sesionDelDia(sumarDias(hoy, -6)), falta1 = await sesionDelDia(sumarDias(hoy, -4)), falta2 = await sesionDelDia(sumarDias(hoy, -2));
await db.query('update sesiones set completada = true, fecha_realizada = $1, dia_previsto = $1 where id = $2', [sumarDias(hoy, -6), hecha.id]);
await db.query('update sesiones set dia_previsto = $1 where id = $2', [sumarDias(hoy, -4), falta1.id]);
await db.query('update sesiones set dia_previsto = $1 where id = $2', [sumarDias(hoy, -2), falta2.id]);
const perfil = (await db.query('select perfil_id from atletas where id = $1', [marta])).rows[0].perfil_id;
await db.query('insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true', [perfil]);
const servidor = `${sinSesion} set role service_role;`;
const alas = (h, dia = hoy) => `${dia} ${h}:00 Europe/Madrid`;
const avisos = async () => (await db.query(`select titulo, clave from notificaciones where usuario_id = $1 and clave like 'esencial_constancia:%'`, [perfil])).rows;
const correr = async (h, dia = hoy) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [alas(h, dia)]); await db.exec('reset role;'); };
await correr('18:30');
check((await avisos()).length === 0, 'apagado («Los avisos de constancia» sin encender): nada');
await db.query(`insert into esencial_ajustes (clave, encendido) values ('avisos_constancia', true) on conflict (clave) do update set encendido = true`);
await correr('12:00');
check((await avisos()).length === 0, 'encendido, a mediodía nada: va a su hora (la de su plan B, la tarde: las 18:00)');
await correr('18:30');
await correr('19:00');
const r = await avisos();
check(r.length === 1 && r[0].titulo === 'Tu semana sigue en pie' && r[0].clave === `esencial_constancia:${sumarDias(hoy, -4)}`, 'a su hora, «Tu semana sigue en pie», una sola vez por cada vez que se le pasan dos');
await db.query('update sesiones set completada = true, fecha_realizada = $1 where id = $2', [sumarDias(hoy, -1), falta2.id]);
await db.query(`delete from notificaciones where usuario_id = $1 and clave like 'esencial_constancia:%'`, [perfil]);
await correr('18:30');
check((await avisos()).length === 0, 'si ha entrenado desde entonces, nada');
await db.query('update sesiones set completada = false, fecha_realizada = null where id = $1', [falta2.id]);
for (const k of [1, 2, 3]) await db.query(`insert into notificaciones (usuario_id, tipo, titulo, cuerpo, clave, enviar_desde, caduca_en, estado) values ($1, 'sesion_hoy', 'x', 'x', $2, $3::timestamptz - interval '1 day', $3::timestamptz, 'enviada')`, [perfil, `esencial_retomar:prueba-${k}`, alas('18:30')]);
await correr('18:30');
check((await avisos()).length === 0, 'con 3 avisos de constancia en los últimos 7 días, ninguno más');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
