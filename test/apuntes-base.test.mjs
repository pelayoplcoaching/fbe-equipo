// Apuntes que se quedan, en la base: la migración 064 en un Postgres local (PGlite). El repaso espaciado (la caja y la
// próxima vez de cada apunte), las preguntas del coach y el aviso de los apuntes por repasar.
//   node test/apuntes-base.test.mjs
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La migración 064 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ana = await usuario('a@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const bea = await usuario('b@x.test');
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [bea]))[0].id;
const hoy = (await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`))[0].d;
const mas = (n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

console.log('El repaso espaciado');
await como(ana);
await q(`select apuntar_apunte('g:rir')`);
await q(`select apuntar_apunte('m:1', false)`);
await q(`select apuntar_apunte(p_apunte => 'i:sueno:0', p_sabia => true, p_caja => 2::smallint, p_proxima => $1::date)`, [mas(7)]);
const filas = await q('select apunte, caja, proxima::text as proxima, sabia from apuntes_vistos order by apunte');
check(filas.length === 3 && filas.find((f) => f.apunte === 'g:rir').caja === 0 && filas.find((f) => f.apunte === 'g:rir').proxima === null, 'sin caja, como en la 061: caja 0 y sin próxima vez (la llamada de antes sigue valiendo)');
check(filas.find((f) => f.apunte === 'i:sueno:0').caja === 2 && filas.find((f) => f.apunte === 'i:sueno:0').proxima === mas(7), 'con caja y próxima vez, se guardan');
await q(`select apuntar_apunte('i:sueno:0', true)`);
check((await q(`select caja, proxima::text as p from apuntes_vistos where apunte = 'i:sueno:0'`))[0].caja === 2, 'si la llamada no dice caja, se queda la que tenía');
await q(`select apuntar_apunte(p_apunte => 'i:sueno:0', p_sabia => false, p_caja => 0::smallint, p_proxima => $1::date)`, [mas(1)]);
const s0 = (await q(`select caja, proxima::text as p, sabia from apuntes_vistos where apunte = 'i:sueno:0'`))[0];
check(s0.caja === 0 && s0.p === mas(1) && s0.sabia === false, 'y si no lo sabe, vuelve a la caja 0 para mañana');
check(await falla(`select apuntar_apunte(p_apunte => 'g:rpe', p_caja => 6::smallint)`) && await falla(`select apuntar_apunte(p_apunte => 'g:rpe', p_caja => -1::smallint)`), 'las cajas van de 0 a 5');
check(await falla(`select apuntar_apunte(p_apunte => 'g:rpe', p_caja => 1::smallint, p_proxima => $1::date)`, [mas(-1)]) && await falla(`select apuntar_apunte(p_apunte => 'g:rpe', p_caja => 1::smallint, p_proxima => $1::date)`, [mas(61)]),
  'la próxima vez, entre hoy y dentro de 60 días');
check(await falla(`update apuntes_vistos set caja = 5 where apunte = 'g:rir'`) || (await q(`select caja from apuntes_vistos where apunte = 'g:rir'`))[0].caja === 0, 'el atleta no lo cambia a mano (solo con la función)');
await como(bea);
check((await q('select apunte from apuntes_vistos')).length === 0, 'otro atleta no ve lo de Ana');
await como(coach, 'aal2');
check((await q(`select caja from apuntes_vistos where atleta_id = $1 and apunte = 'i:sueno:0'`, [atletaA])).length === 1, 'su coach sí');
await su();
check(await falla(`update apuntes_vistos set caja = 9 where apunte = 'g:rir'`) && await falla(`update apuntes_vistos set proxima = ultimo - 1 where apunte = 'g:rir'`), 'ni a mano: las reglas de la tabla lo impiden');

console.log('Las preguntas del coach');
await como(coach, 'aal2');
const [p1] = await q(`insert into novedades (tipo, titulo, texto, opciones, correcta, explicaciones, publicada) values ('pregunta', '¿Cuánto descanso entre series pesadas?', 'Entre 2 y 3 minutos rinden más.',
  '["30 segundos", "Entre 2 y 3 minutos", "10 minutos"]'::jsonb, 1, '["Poco: llegas sin fuerza", "", "Demasiado: enfría"]'::jsonb, true) returning id, tipo`);
check(p1.tipo === 'pregunta', 'el coach escribe una pregunta con sus opciones, la buena y el porqué de las malas');
check(await falla(`insert into novedades (tipo, titulo, texto, opciones, correcta) values ('pregunta', 't', 'x', '["a"]'::jsonb, 0)`)
  && await falla(`insert into novedades (tipo, titulo, texto, opciones, correcta) values ('pregunta', 't', 'x', '["a", "b", "c", "d", "e"]'::jsonb, 0)`)
  && await falla(`insert into novedades (tipo, titulo, texto, opciones, correcta) values ('pregunta', 't', 'x', '["a", "b"]'::jsonb, 2)`)
  && await falla(`insert into novedades (tipo, titulo, texto, opciones) values ('pregunta', 't', 'x', '["a", "b"]'::jsonb)`)
  && await falla(`insert into novedades (tipo, titulo, texto, opciones, correcta, explicaciones) values ('pregunta', 't', 'x', '["a", "b"]'::jsonb, 0, '["solo una"]'::jsonb)`),
  'entre dos y cuatro opciones, con la buena entre ellas y, si hay explicaciones, una por opción');
check(await falla(`insert into novedades (tipo, titulo, texto, opciones, correcta) values ('novedad', 't', 'x', '["a", "b"]'::jsonb, 0)`) && await falla(`insert into novedades (tipo, titulo, texto) values ('otra', 't', 'x')`),
  'una novedad o un apunte no llevan opciones, y no hay otros tipos');
check(!(await falla(`insert into novedades (tipo, titulo, texto, publicada) values ('apunte', 'Un apunte', 'x', false)`)), 'los apuntes sueltos siguen como en la 061');
await como(ana);
const vistas = await q(`select tipo, opciones, correcta, explicaciones from novedades where tipo = 'pregunta'`);
check(vistas.length === 1 && vistas[0].opciones.length === 3 && vistas[0].correcta === 1 && vistas[0].explicaciones[2] === 'Demasiado: enfría', 'publicada, sus atletas la ven entera');

console.log('El aviso de los apuntes por repasar');
await su();
await q(`insert into preferencias_notificaciones (usuario_id, email, hora_tarde) values ($1, true, '21:00'), ($2, true, '21:00')`, [ana, bea]);
// Ana: cuatro por repasar (hoy o antes); Bea: dos
await q(`delete from apuntes_vistos`);
for (const [a, n] of [[atletaA, 4], [atletaB, 2]]) for (let i = 0; i < n; i++) await q(`insert into apuntes_vistos (atleta_id, apunte, ultimo, caja, proxima) values ($1, $2, $3::date - 3, 1, $3::date - (${i} % 2))`, [a, `g:t${i}`, hoy]);
await q(`insert into apuntes_vistos (atleta_id, apunte, ultimo, caja, proxima) values ($1, 'g:mas', $2::date, 2, $2::date + 5)`, [atletaA, hoy]);
const a19 = `${hoy} 19:30:00 Europe/Madrid`, a15 = `${hoy} 15:00:00 Europe/Madrid`;
check((await q(`select crear_recordatorios_apuntes($1::timestamptz) as n`, [a15]))[0].n === 0, 'a las tres de la tarde, aún no (va en las dos horas antes de su hora de la tarde)');
const n1 = (await q(`select crear_recordatorios_apuntes($1::timestamptz) as n`, [a19]))[0].n;
const notis = await q(`select usuario_id, tipo, titulo, url from notificaciones where tipo = 'repaso'`);
check(n1 === 1 && notis.length === 1 && notis[0].usuario_id === ana && notis[0].titulo === 'Tienes 4 apuntes por repasar' && notis[0].url === '#semana', 'a las siete y media, a Ana (cuatro por repasar): «Tienes 4 apuntes por repasar»; a Bea (dos), no');
await q(`select crear_recordatorios_apuntes($1::timestamptz)`, [`${hoy} 20:15:00 Europe/Madrid`]);
check((await q(`select count(*)::int as n from notificaciones where tipo = 'repaso'`))[0].n === 1, 'una vez al día, como mucho');
await q(`delete from notificaciones where tipo = 'repaso'`);
await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha, repaso}' where usuario_id = $1`, [ana]);
check((await q(`select crear_recordatorios_apuntes($1::timestamptz) as n`, [`${hoy} 19:31:00 Europe/Madrid`]))[0].n === 0, 'quien lo apaga en sus avisos no lo recibe');
await q(`update preferencias_notificaciones set desactivados = '{sesion_hecha}' where usuario_id = $1`, [ana]);
// con una sesión prevista hoy, tampoco (es día de entrenar)
const [b] = await q(`insert into bloques (atleta_id, nombre, fecha_inicio, estado) values ($1, 'B', $2, 'activo') returning id`, [atletaA, hoy]).catch(() => [null]);
let conSesion = false;
if (b) {
  const [w] = await q(`insert into semanas (bloque_id, numero, programacion, fecha_inicio) values ($1, 1, 'programada', $2::date - (extract(isodow from $2::date)::int - 1)) returning id`, [b.id, hoy]).catch((e) => { console.log('    (semana)', e.message); return [null]; });
  if (w) { await q(`insert into sesiones (semana_id, nombre, dia_previsto, orden) values ($1, 'Torso', $2, 1)`, [w.id, hoy]); conSesion = true; }
}
check(conSesion && (await q(`select crear_recordatorios_apuntes($1::timestamptz) as n`, [`${hoy} 19:32:00 Europe/Madrid`]))[0].n === 0, 'y el día que tiene sesión, tampoco');
await como(ana);
check(await falla(`select crear_recordatorios_apuntes()`), 'solo la puede llamar el servidor');
await su();
check(await falla(`insert into notificaciones (usuario_id, tipo, titulo, url, clave) values ($1, 'otro', 't', '#semana', 'k')`, [ana]) && !(await falla(`update preferencias_notificaciones set desactivados = '{repaso}' where usuario_id = $1`, [bea])), 'el tipo de aviso nuevo se puede apagar; los inventados no existen');
check((await q(`select count(*)::int as n from fbe_migraciones where numero = 62`))[0].n === 1, 'la 064 queda apuntada');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
