// Los suplementos de cada atleta (migración 077): lo que pauta el coach o añade el atleta, lo que marca cada día y su
// aviso al móvil. La lógica, la demo y la base (PGlite).
//   node test/suplementos.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const S = await import('../web/src/logica/suplementos.js');
const { sumarDias, hoyISO, fechaMadrid } = await import('../web/src/logica/fechas.js');

console.log('La lógica');
const HOY = '2026-11-15';
check(S.SUPLEMENTOS_FBE.length === 8 && S.SUPLEMENTOS_FBE.every((x) => /^[a-z0-9-]{1,30}$/.test(x.clave) && x.nombre.length <= S.MAX_NOMBRE && x.dosis.length <= S.MAX_DOSIS && S.NOMBRE_MOMENTO[x.momento])
  && new Set(S.SUPLEMENTOS_FBE.map((x) => x.clave)).size === 8 && S.deLaLista('creatina').dosis === '3-5 g al día', 'la lista de FBE: ocho, cada uno con su dosis habitual y su momento (caben en la base)');
check(S.limpiarSuplemento({ nombre: '  Creatina   monohidrato ', dosis: ' 5 g ', momento: 'manana', clave: 'creatina' }).datos.nombre === 'Creatina monohidrato'
  && S.limpiarSuplemento({ nombre: 'Zinc', clave: 'no-esta', momento: 'raro' }).datos.clave === null && S.limpiarSuplemento({ nombre: 'Zinc', momento: 'raro' }).datos.momento === 'cuando'
  && S.limpiarSuplemento({ nombre: 'Zinc' }).datos.dosis === null && S.limpiarSuplemento({ id: 'x', nombre: 'Zinc' }).datos.id === 'x', 'lo que se guarda, limpio (la clave, solo si es de la lista; sin momento, «cuando quieras»)');
check(S.limpiarSuplemento({ nombre: ' ' }).error && S.limpiarSuplemento({ nombre: 'x'.repeat(41) }).error && S.limpiarSuplemento({ nombre: 'Zinc', dosis: 'd'.repeat(41) }).error, 'sin nombre o demasiado largo, no');
check(S.horaValida('08:00') && S.horaValida('23:30') && !S.horaValida('04:59') && !S.horaValida('23:45') && !S.horaValida('8:00') && !S.horaValida('25:00') && !S.horaValida(null), 'la hora del aviso, de 5:00 a 23:30');
check(S.detalleSuplemento({ dosis: '3-5 g al día', momento: 'cuando' }) === '3-5 g al día' && S.detalleSuplemento({ dosis: '200 mg', momento: 'noche' }) === '200 mg · Por la noche' && S.detalleSuplemento({ momento: 'cuando' }) === '', 'el detalle: su dosis y su momento');
{
  const sup = [{ id: 'a', nombre: 'Creatina', activo: true, creado_en: '2026-11-01T10:00:00Z' }, { id: 'b', nombre: 'Omega-3', activo: true, creado_en: '2026-11-13T10:00:00Z' }, { id: 'c', nombre: 'Vieja', activo: false }];
  const tomas = [...[0, 1, 2, 4].map((i) => ({ suplemento_id: 'a', fecha: sumarDias(HOY, -i) })), { suplemento_id: 'b', fecha: sumarDias(HOY, -1) }];
  const h = S.suplementosDeHoy({ suplementos: sup, tomas }, HOY);
  check(h.total === 2 && h.quedan === 1 && h.lista[0].tomado && !h.lista[1].tomado, 'lo de hoy: los activos, con cuáles ha tomado y cuántos quedan');
  const ca = S.constanciaSuplemento(sup[0], tomas, HOY), cb = S.constanciaSuplemento(sup[1], tomas, HOY);
  check(ca.de === 7 && ca.tomados === 4 && ca.pct === 57 && ca.racha === 3 && cb.de === 2 && cb.tomados === 1 && cb.racha === 1, 'la constancia de la semana (desde que se lo pusieron; hoy no cuenta en contra hasta marcarlo) y su racha');
  check(S.porAnadir([{ clave: 'creatina', nombre: 'Creatina monohidrato', activo: true }, { clave: null, nombre: 'omega-3', activo: true }, { clave: 'cafeina', nombre: 'Cafeína', activo: false }]).length === 6, 'de la lista se le ofrecen los que aún no tiene');
}

console.log('\nEn la demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const legal = await import('../web/src/legal.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const atletas = await api.atletas();
const ivan = atletas.find((a) => /Iván/.test(a.nombre)), carlos = atletas.find((a) => /Carlos/.test(a.nombre));
check((await api.suplementos077()) === true && (await api.versionLegal()) === legal.VERSION_LEGAL && legal.VERSION_LEGAL === '2026-12.41', 'la demo tiene la 077 (y la política nueva)');
const crea = await api.guardarSuplemento(ivan.id, { ...S.deLaLista('creatina') });
check(crea.origen === 'coach' && crea.clave === 'creatina' && crea.dosis === '3-5 g al día' && crea.activo && crea.aviso_hora === null, 'el coach le pauta la creatina de la lista');
check(await lanza(() => api.guardarSuplemento(ivan.id, { nombre: 'creatina MONOHIDRATO' })) && await lanza(() => api.guardarSuplemento(null, { nombre: 'Zinc' })) && await lanza(() => api.tomarSuplemento(crea.id, hoyISO()))
  && await lanza(() => api.avisoSuplemento(crea.id, '08:00')), 'repetido no; el coach dice de quién; marcar y elegir el aviso son cosa del atleta');
const cambiado = await api.guardarSuplemento(ivan.id, { id: crea.id, clave: 'creatina', nombre: 'Creatina monohidrato', dosis: '5 g al día', momento: 'manana' });
check(cambiado.dosis === '5 g al día' && cambiado.momento === 'manana' && cambiado.id === crea.id, 'y le ajusta la dosis');
await b.auth.salir();
await b.auth.entrar('ivan@fbe.demo', 'demo');
const hoyM = fechaMadrid();
let mio = await api.suplementos();
check(mio.suplementos.length === 1 && mio.tomas.length === 0, 'el atleta ve lo que le ha pautado su coach');
const suyo = await api.guardarSuplemento(null, { nombre: 'Magnesio', dosis: '300 mg', momento: 'noche', clave: 'magnesio' });
check(suyo.origen === 'atleta' && await lanza(() => api.guardarSuplemento(null, { id: crea.id, nombre: 'Otra cosa' })) && await lanza(() => api.quitarSuplemento(crea.id)), 'añade el suyo; el del coach no lo cambia ni lo quita');
await api.tomarSuplemento(crea.id, hoyM); await api.tomarSuplemento(crea.id, hoyM); await api.tomarSuplemento(suyo.id, sumarDias(hoyM, -1));
mio = await api.suplementos();
check(mio.tomas.length === 2 && S.suplementosDeHoy(mio, hoyM).quedan === 1 && await lanza(() => api.tomarSuplemento(crea.id, sumarDias(hoyM, -3))) && await lanza(() => api.tomarSuplemento(crea.id, sumarDias(hoyM, 2))),
  'marca lo de hoy (dos veces no duplica) y lo de ayer; más atrás, no');
await api.tomarSuplemento(crea.id, hoyM, false);
check((await api.suplementos()).tomas.length === 1, 'y lo desmarca');
const conAviso = await api.avisoSuplemento(crea.id, '08:30');
check(conAviso.aviso_hora === '08:30' && await lanza(() => api.avisoSuplemento(crea.id, '03:00')) && await lanza(() => b.rpc('suplemento_aviso', { p_id: crea.id, p_hora: '8:30' })) && (await api.avisoSuplemento(crea.id, null)).aviso_hora === null,
  'elige la hora de su aviso (de 5:00 a 23:30), también en el que le pautó su coach, y lo quita');
check(await lanza(() => b.select('suplementos', {})) && await lanza(() => b.select('suplementos_tomas', {})) && await lanza(() => b.insert('suplementos', [{ atleta_id: ivan.id, nombre: 'x', origen: 'atleta' }]))
  && (await api.suplementos(carlos.id)).suplementos.every((x) => x.atleta_id === ivan.id), 'las tablas no se tocan directamente (y aunque pida los de otro, ve los suyos)');
for (let i = 0; i < 6; i++) await api.guardarSuplemento(null, { nombre: `Extra ${i}` });
check(await lanza(() => api.guardarSuplemento(null, { nombre: 'El noveno' })), 'como mucho, 8 a la vez');
await api.quitarSuplemento(suyo.id);
mio = await api.suplementos();
check(mio.suplementos.length === 7 && !mio.suplementos.some((x) => x.id === suyo.id) && (await api.suplementos(null, { todos: true })).suplementos.some((x) => x.id === suyo.id && !x.activo), 'quita el suyo: se archiva (lo apuntado se conserva)');
const datos = await api.misDatos?.().catch(() => null);
if (datos) check(datos.suplementos?.suplementos?.length === 8 && datos.suplementos.tomas.length >= 1, 'va en «Descargar mis datos», con los archivados');
await b.auth.salir();
await b.auth.entrar('carlos@fbe.demo', 'demo');
check((await api.suplementos()).suplementos.length === 0 && await lanza(() => api.tomarSuplemento(crea.id, hoyM)) && await lanza(() => api.quitarSuplemento(crea.id)) && await lanza(() => api.avisoSuplemento(crea.id, '09:00')), 'otro atleta no ve los suyos ni los toca');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const deIvan = await api.suplementos(ivan.id);
check(deIvan.suplementos.length === 7 && deIvan.tomas.length >= 1, 'el coach ve lo que toma y lo que marca');
await api.quitarSuplemento(crea.id);
check((await api.suplementos(ivan.id)).suplementos.length === 6 && (await b.rpc('copia_privada', {})).suplementos.length === 8, 'se lo quita (archivado), y todo va en su copia completa');

console.log('\nLa migración 077 (PGlite)');
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
const ana = await usuario('a@x.test'), luis = await usuario('l@x.test'), baja = await usuario('b@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
const atletaL = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [luis]))[0].id;
await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Baja', $1, 'baja')`, [baja]);
const [{ d: hoy }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const guardar = (atleta, d) => q('select suplemento_guardar($1, $2::jsonb) as r', [atleta, JSON.stringify(d)]).then((r) => r[0].r);
const noGuardar = (atleta, d) => falla('select suplemento_guardar($1, $2::jsonb)', [atleta, JSON.stringify(d)]);
const de = (atleta = null, todos = false) => q('select suplementos_de($1, null, $2) as r', [atleta, todos]).then((r) => r[0].r);

await como(coach, 'aal2');
const c1 = await guardar(atletaA, { clave: 'creatina', nombre: '  Creatina\u200b   monohidrato ', dosis: '3-5 g al día', momento: 'cuando' });
check(c1.nombre === 'Creatina monohidrato' && c1.origen === 'coach' && c1.activo === true && c1.aviso_hora === null && c1.clave === 'creatina', 'el coach pauta un suplemento (limpio)');
check(await noGuardar(null, { nombre: 'Zinc' }) && await noGuardar(atletaA, { nombre: 'CREATINA monohidrato' }) && await noGuardar(atletaA, { nombre: '' }) && await noGuardar(atletaA, { nombre: 'x'.repeat(41) })
  && await noGuardar(atletaA, { nombre: 'Zinc', dosis: 'd'.repeat(41) }) && await noGuardar(atletaA, { nombre: 'Zinc', momento: 'tarde' }) && await noGuardar(atletaA, { nombre: 'Zinc', clave: 'Con Mayúsculas' })
  && await noGuardar(atletaA, { nombre: 5 }) && await noGuardar(atletaA, ['x']) && await noGuardar(atletaA, { id: 'no-uuid', nombre: 'Zinc' }) && await noGuardar(atletaL, { id: c1.id, nombre: 'Zinc' })
  && await noGuardar('00000000-0000-0000-0000-000000000000', { nombre: 'Zinc' }), 'sin atleta, repetido, sin nombre, largo, con datos raros o de otro atleta, no');
check(await falla('select suplemento_tomar($1)', [c1.id]) && await falla(`select suplemento_aviso($1, '08:00')`, [c1.id]), 'marcar y elegir el aviso son cosa del atleta');

await como(ana);
let r = await de();
check(r.suplementos.length === 1 && r.tomas.length === 0, 'el atleta ve lo que le ha pautado su coach');
const a1 = await guardar(null, { nombre: 'Magnesio', dosis: '300 mg', momento: 'noche' });
check(a1.origen === 'atleta' && await noGuardar(null, { id: c1.id, nombre: 'Otra' }) && await falla('select suplemento_quitar($1)', [c1.id]), 'añade el suyo; el del coach no lo cambia ni lo quita');
check((await guardar(atletaL, { nombre: 'Zinc' })).atleta_id === atletaA, 'aunque diga otro atleta, lo suyo es suyo');
await q('select suplemento_tomar($1)', [c1.id]); await q('select suplemento_tomar($1, $2)', [c1.id, hoy]); await q('select suplemento_tomar($1, $2)', [a1.id, sumarDias(hoy, -1)]);
r = await de();
check(r.tomas.length === 2 && await falla('select suplemento_tomar($1, $2)', [c1.id, sumarDias(hoy, -2)]) && await falla('select suplemento_tomar($1, $2)', [c1.id, sumarDias(hoy, 2)]), 'marca hoy (dos veces no duplica) y ayer; más atrás, no');
await q('select suplemento_tomar($1, $2, false)', [c1.id, hoy]);
check((await de()).tomas.length === 1, 'y lo desmarca');
const av = (await q(`select suplemento_aviso($1, '08:30') as r`, [c1.id]))[0].r;
check(av.aviso_hora === '08:30' && await falla(`select suplemento_aviso($1, '04:00')`, [c1.id]) && await falla(`select suplemento_aviso($1, '23:45')`, [c1.id]) && await falla(`select suplemento_aviso($1, '8:30')`, [c1.id])
  && await falla(`select suplemento_aviso($1, 'now')`, [c1.id]), 'elige la hora de su aviso (de 5:00 a 23:30, como HH:MM), también en el que le pautó su coach');
check(await falla('select * from suplementos') && await falla('select * from suplementos_tomas') && await falla(`insert into suplementos (atleta_id, nombre, origen) values ($1, 'x', 'atleta')`, [atletaA])
  && await falla(`insert into suplementos_tomas (suplemento_id, atleta_id, fecha) values ($1, $2, $3)`, [c1.id, atletaA, hoy]) && await falla(`update suplementos set nombre = 'x'`), 'las tablas no se tocan directamente');
for (let i = 0; i < 5; i++) await guardar(null, { nombre: `Extra ${i}` });
check(await noGuardar(null, { nombre: 'El noveno' }), 'como mucho, 8 a la vez');
await como(luis);
check((await de()).suplementos.length === 0 && await falla('select suplemento_tomar($1)', [c1.id]) && await falla('select suplemento_quitar($1)', [a1.id]) && await falla(`select suplemento_aviso($1, '09:00')`, [c1.id])
  && await noGuardar(null, { id: a1.id, nombre: 'Mío ahora' }), 'otro atleta no ve los suyos ni los toca');
await como(baja);
check(await noGuardar(null, { nombre: 'Zinc' }), 'de baja, no añade');
await su();
await db.exec(`reset role; set role anon;`);
check(await falla('select suplementos_de()') && await falla(`select fbe_privado.recordatorios_suplementos()`), 'sin sesión, nada');

// El aviso: a su hora (hora de España), si aún no lo ha marcado; uno por atleta y hora
await su();
await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [ana]);
const a830 = `${hoy} 08:40:00 Europe/Madrid`;
const n0 = (await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz) as n`, [`${hoy} 08:10:00 Europe/Madrid`]))[0].n;
const n1 = (await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz) as n`, [a830]))[0].n;
const n2 = (await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz) as n`, [a830]))[0].n;
const notis = await q(`select tipo, titulo, url, clave from public.notificaciones where usuario_id = $1 and tipo = 'suplementos'`, [ana]);
check(n0 === 0 && n1 === 1 && notis.length === 1 && notis[0].titulo === 'Te toca: Creatina monohidrato' && notis[0].url === '#hoy' && n2 <= 1 && (await q(`select count(*)::int n from public.notificaciones where tipo = 'suplementos'`))[0].n === 1,
  'a su hora le llega «Te toca: Creatina monohidrato» (antes no; repetir la pasada no lo duplica)');
await q(`delete from public.notificaciones where tipo = 'suplementos'`);
await q(`insert into public.suplementos_tomas (suplemento_id, atleta_id, fecha) values ($1, $2, $3)`, [c1.id, atletaA, hoy]);
check((await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz) as n`, [a830]))[0].n === 0, 'si ya lo ha marcado hoy, no avisa');
await q(`delete from public.suplementos_tomas where suplemento_id = $1 and fecha = $2`, [c1.id, hoy]);
await q(`update public.preferencias_notificaciones set desactivados = array['suplementos'] where usuario_id = $1`, [ana]);
check((await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz) as n`, [a830]))[0].n === 0, 'ni con el aviso de suplementos apagado en Ajustes');
await q(`update public.preferencias_notificaciones set desactivados = '{}' where usuario_id = $1`, [ana]);
await q(`update public.suplementos set aviso_hora = '08:30' where id = $1`, [a1.id]);
await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz)`, [a830]);
check((await q(`select titulo from public.notificaciones where tipo = 'suplementos'`)).map((x) => x.titulo).join() === 'Te tocan 2 suplementos', 'dos a la misma hora, un solo aviso: «Te tocan 2 suplementos»');

// (revisión) el «no molestar» no lo retrasa ni se lo come: a las 06:30 y a las 23:00 sale a su hora
await q(`delete from public.notificaciones where tipo = 'suplementos'`);
await q(`update public.suplementos set aviso_hora = '06:30' where id = $1`, [c1.id]);
await q(`update public.suplementos set aviso_hora = '23:00' where id = $1`, [a1.id]);
await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz)`, [`${hoy} 06:35:00 Europe/Madrid`]);
await q(`select fbe_privado.recordatorios_suplementos($1::timestamptz)`, [`${hoy} 23:05:00 Europe/Madrid`]);
const fuera = await q(`select to_char(enviar_desde at time zone 'Europe/Madrid', 'HH24:MI') h from public.notificaciones where tipo = 'suplementos' order by enviar_desde`);
check(fuera.map((x) => x.h).join() === '06:35,23:05', '(revisión) el «no molestar» no retrasa ni descarta el aviso: a las 06:30 y a las 23:00 sale a su hora');
// (revisión) al cambiar el nombre tampoco se repite, y uno archivado no se cambia
await como(ana);
check(await noGuardar(null, { id: a1.id, nombre: 'ZINC' }), '(revisión) cambiarle el nombre al de otro que ya tiene, no');

await como(coach, 'aal2');
r = await de(atletaA);
check(r.suplementos.length === 8 && r.tomas.length === 1 && await falla('select suplementos_de()'), 'el coach ve lo que toma y lo que marca (y dice de quién)');
await q('select suplemento_quitar($1)', [c1.id]);
check((await de(atletaA)).suplementos.length === 7 && (await de(atletaA, true)).suplementos.find((x) => x.id === c1.id).activo === false && (await de(atletaA, true)).suplementos.find((x) => x.id === c1.id).aviso_hora === null
  && !(await noGuardar(atletaA, { id: a1.id, nombre: 'Magnesio bisglicinato', dosis: '300 mg', momento: 'noche' })), 'se lo quita (archivado, sin aviso) y puede cambiar el que añadió el atleta');
const copia = (await q('select copia_privada() as c'))[0].c;
check(copia.suplementos.length === 8 && copia.suplementos_tomas.length === 1 && copia.objetivos_propuestos, 'va en la copia completa del coach (con lo de la 076)');
check(await noGuardar(atletaA, { id: c1.id, nombre: 'Creatina otra vez' }), '(revisión) uno archivado no se cambia');
await como(ana);
check(await falla('select suplemento_tomar($1)', [c1.id]) && await falla(`select suplemento_aviso($1, '09:00')`, [c1.id]), 'uno archivado ya no se marca ni avisa');
await su();
await q('delete from atletas where id = $1', [atletaA]);
check((await q('select count(*)::int n from suplementos'))[0].n === 0 && (await q('select count(*)::int n from suplementos_tomas'))[0].n === 0, 'todo se borra con la ficha del atleta');
const mig = lee('supabase/migraciones/077_suplementos.sql'), p76 = lee('supabase/migraciones/076_objetivos_atleta.sql'), m64 = lee('supabase/migraciones/064_apuntes_repaso.sql');
const permisos = (s) => s.slice(s.indexOf('revoke truncate, references, trigger'), s.indexOf('insert into public.fbe_migraciones'));
const cuerpo = (s) => { const i = s.indexOf('create or replace function public.crear_recordatorios_apuntes'); return s.slice(i, s.indexOf('end $$;', i)); };
check(/if v > 77 then/.test(mig) && /numero = 76\) then/.test(mig) && /values \(77\)/.test(mig) && permisos(mig) === permisos(p76), 'pide la 076; el bloque de permisos, el mismo que el de la 076');
check(cuerpo(mig).replace(/  -- \(077\)[^\n]*\n  -- \(revisión\)[^\n]*\n  begin\n    v_n := v_n \+ fbe_privado\.recordatorios_suplementos\(p_ahora\);\n  exception when others then\n[^\n]*\n  end;\n/, '') === cuerpo(m64) && /'tarea', 'tarea_hecha', 'repaso', 'suplementos'\)/.test(mig),
  'el aviso de los apuntes por repasar sigue igual que en la 064, y en la misma pasada salen los de los suplementos');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
