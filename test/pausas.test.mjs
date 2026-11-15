// Pausar la asesoría (migración 078): las pausas que pone el coach, la racha que no se rompe, los recordatorios que
// no salen y las alertas del panel que se callan (el atleta sigue activo: los mensajes de su coach le llegan). La lógica, la demo y la base (PGlite).
//   node test/pausas.test.mjs
import { readFileSync } from 'node:fs';
let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const P = await import('../web/src/logica/pausas.js');
const { racha } = await import('../web/src/logica/calculos.js');
const { sumarDias, lunesDe, fechaMadrid } = await import('../web/src/logica/fechas.js');

console.log('La lógica');
const HOY = '2026-11-18';   // miércoles
const pausas = [{ id: 1, desde: '2026-11-02', hasta: '2026-11-15', motivo: 'vacaciones' }, { id: 2, desde: '2026-12-01', hasta: null, motivo: 'personal' }];
check(P.pausaVigente(pausas, '2026-11-10')?.id === 1 && P.pausaVigente(pausas, HOY) === null && P.pausaVigente(pausas, '2027-03-01')?.id === 2 && P.pausaProxima(pausas, HOY)?.id === 2 && P.pausaProxima(pausas, '2026-12-05') === null,
  'la pausa de hoy (con o sin fecha de vuelta) y la próxima');
check(P.limpiarPausa({ desde: '2026-11-02', hasta: '', motivo: 'vacaciones', nota: '  Pásalo   bien ' }).datos.nota === 'Pásalo bien' && P.limpiarPausa({ desde: '2026-11-02', motivo: 'vacaciones' }).datos.hasta === null
  && P.limpiarPausa({ motivo: 'vacaciones' }).error && P.limpiarPausa({ desde: '2026-11-02', hasta: '2026-11-01', motivo: 'vacaciones' }).error && P.limpiarPausa({ desde: '2026-11-02', motivo: 'porque sí' }).error
  && P.limpiarPausa({ desde: '2026-11-02', motivo: 'otro', nota: 'n'.repeat(201) }).error, 'lo que se guarda: desde, vuelta (o sin ella), motivo de la lista y un mensaje corto');
check(P.textoPausaCoach(pausas[0]) === 'En pausa hasta el 15 nov (vacaciones)' && P.textoPausaCoach(pausas[1]) === 'En pausa sin fecha de vuelta (motivos personales)' && P.diaDeVuelta(pausas[0]) === '2026-11-16'
  && /Vuelves el 16 nov/.test(P.textoPausaAtleta(pausas[0]).detalle) && /Sin fecha de vuelta/.test(P.textoPausaAtleta(pausas[1]).detalle) && P.diasDePausa(pausas[0], '2026-11-05') === 4, 'sus textos, para el coach y para el atleta (vuelve al día siguiente)');
check(P.semanaEnPausa(pausas, '2026-11-02') && P.semanaEnPausa(pausas, '2026-11-09') && !P.semanaEnPausa(pausas, '2026-11-16') && !P.semanaEnPausa(pausas, '2026-10-26')
  && P.semanaEnPausa([{ desde: '2026-11-05', hasta: '2026-11-20' }], '2026-11-02') && P.semanaEnPausa([{ desde: '2026-11-06', hasta: '2026-11-12' }], '2026-11-02') && P.semanaEnPausa([{ desde: '2026-11-06', hasta: '2026-11-12' }], '2026-11-09')
  && !P.semanaEnPausa([{ desde: '2026-11-07', hasta: '2026-11-20' }], '2026-11-02'), 'una semana es de pausa si la pausa cubre tres días o más (una pausa de siete días protege las dos semanas que pisa)');
{
  const sem = (lunes, hechas) => ({ fecha_inicio: lunes, total: 3, hechas });
  const semanas = [sem('2026-10-19', 3), sem('2026-10-26', 3), sem('2026-11-02', 0), sem('2026-11-09', 1), sem('2026-11-16', 1)];
  const enPausa = (l) => P.semanaEnPausa(pausas, l);
  check(racha(semanas, HOY) === 0 && racha(semanas, HOY, enPausa) === 2, 'la racha no se rompe por las semanas de pausa (sin pausa, sí)');
  check(racha([...semanas.slice(0, 4), sem('2026-11-16', 3)], HOY, enPausa) === 3 && racha([sem('2026-10-19', 3), sem('2026-10-26', 1), sem('2026-11-02', 0), sem('2026-11-09', 0), sem('2026-11-16', 3)], HOY, enPausa) === 1
    && racha([sem('2026-10-26', 3), sem('2026-11-02', 3), sem('2026-11-09', 0)], HOY, enPausa) === 2, 'a la vuelta sigue sumando; una semana sin completar de antes de la pausa sí rompe; una de pausa completa cuenta');
}

console.log('\nEn la demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);
const hoy = fechaMadrid();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const ana = (await api.atletas()).find((a) => /Ana/.test(a.nombre)), carlos = (await api.atletas()).find((a) => /Carlos/.test(a.nombre));
const filaDe = async (id) => (await api.resumenes()).find((r) => r.atleta_id === id);
check((await api.pausas078()) === true && (await api.pausas(ana.id)).length === 0 && (await filaDe(carlos.id)).alertas.some((a) => a.tipo === 'sin_entrenar') && (await filaDe(carlos.id)).pausa === null, 'la demo tiene la 078; nadie en pausa (Carlos, con su alerta de que no entrena)');
const rachaAntes = (await api.constancia(ana.id)).racha;
const p1 = await api.guardarPausa(carlos.id, { desde: sumarDias(hoy, -10), hasta: sumarDias(hoy, 4), motivo: 'vacaciones', nota: 'Pásalo bien' });
let fc = await filaDe(carlos.id);
check(p1.motivo === 'vacaciones' && fc.estado === 'pausado' && fc.pausa?.id === p1.id && !fc.alertas.some((a) => a.tipo === 'sin_entrenar' || a.tipo === 'cumplimiento') && (await api.atletas()).find((a) => a.id === carlos.id).estado === 'activo',
  'el coach lo pone en pausa: en el panel sale en pausa y sin alertas (en la base sigue activo, para que le lleguen sus mensajes)');
{
  const { filasRadar } = await import('../web/src/logica/radar/radar.js').catch(() => ({}));
  check((await api.resumenes()).filter((r) => r.estado === 'activo').every((r) => r.atleta_id !== carlos.id), 'y no cuenta entre los activos de «A quién escribir» ni del tablero');
}
await api.guardarPausa(ana.id, { desde: sumarDias(hoy, -20), hasta: sumarDias(hoy, -8), motivo: 'trabajo' });
const c = await api.constancia(ana.id);
check(c.pausas.length === 1 && c.racha >= rachaAntes && c.semanas.filter((w) => w.pausa).every((w) => w.total === 0), `la racha no baja por las semanas de pausa (${rachaAntes} → ${c.racha}); en su calendario salen como semanas sin nada programado`);
check(await lanza(() => api.guardarPausa(ana.id, { desde: hoy, hasta: sumarDias(hoy, -1), motivo: 'otro' })) && await lanza(() => api.guardarPausa(ana.id, { desde: hoy, motivo: 'siesta' }))
  && await lanza(() => api.crear('pausas', { atleta_id: ana.id, desde: hoy, motivo: 'enfermedad' })), 'una pausa sin sentido o con un motivo de salud, no');
await b.auth.salir();
await b.auth.entrar('carlos@fbe.demo', 'demo');
const mias = await api.pausas(carlos.id);
check(mias.length === 1 && mias[0].nota === 'Pásalo bien' && (await api.pausas(ana.id)).length === 0 && await lanza(() => api.guardarPausa(carlos.id, { desde: hoy, motivo: 'otro' }))
  && (await api.quitarPausa(p1.id), (await api.pausas(carlos.id)).length === 1) && (await api.actualizar('pausas', p1.id, { hasta: sumarDias(hoy, 60) }).catch(() => null), (await api.pausas(carlos.id))[0].hasta === sumarDias(hoy, 4)),
'el atleta ve la suya (con el mensaje de su coach), no las de otros, y no las pone, cambia ni quita');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
await api.guardarPausa(carlos.id, { id: p1.id, desde: sumarDias(hoy, -10), hasta: sumarDias(hoy, -1), motivo: 'vacaciones', nota: 'Pásalo bien' });
fc = await filaDe(carlos.id);
check(fc.estado === 'activo' && fc.pausa === null && fc.alertas.some((a) => a.tipo === 'sin_entrenar') && (await api.pausas(carlos.id)).length === 1, '«Terminar hoy» (último día, ayer): vuelve con sus alertas y la pausa queda en su historial');
await api.guardarPausa(carlos.id, { desde: hoy, motivo: 'otro' });
check((await filaDe(carlos.id)).estado === 'pausado', 'otra, sin fecha de vuelta');
for (const x of await api.pausas(carlos.id)) await api.quitarPausa(x.id);
check((await filaDe(carlos.id)).estado === 'activo' && (await b.rpc('copia_privada', {})).pausas?.length === 1, 'al quitárselas, vuelve; las pausas van en la copia completa del coach');

console.log('\nLa migración 078 (PGlite)');
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
const uA = await usuario('a@x.test'), uL = await usuario('l@x.test');
const A = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [uA]))[0].id;
const L = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Luis', $1, 'activo') returning id`, [uL]))[0].id;
for (const u of [uA, uL]) await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [u]);
const [{ d: hoyB }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const mas = (n) => sumarDias(hoyB, n);
const destinatario = async (id) => { await su(); const n = (await q('select count(*)::int n from fbe_privado.destinatarios where atleta_id = $1', [id]))[0].n; await como(coach, 'aal2'); return n === 1; };

await como(coach, 'aal2');
check(await destinatario(A) && await destinatario(L), 'sin pausas, los dos reciben recordatorios');
const [pa] = await q(`insert into pausas (atleta_id, desde, hasta, motivo, nota) values ($1, $2, $3, 'vacaciones', 'Pásalo bien') returning *`, [A, mas(-3), mas(4)]);
await q(`insert into pausas (atleta_id, desde, hasta, motivo) values ($1, $2, $3, 'trabajo')`, [L, mas(2), mas(9)]);
check(!(await destinatario(A)) && await destinatario(L), 'con una pausa que cubre hoy, no recibe recordatorios; con una que empieza otro día, todavía sí');
{
  await su();
  const est = (await q('select estado from public.atletas where id = $1', [A]))[0].estado;
  await como(coach, 'aal2');
  await q(`insert into public.comentarios (atleta_id, autor, texto) values ($1, 'coach', '¿Cuándo vuelves?')`, [A]).catch(() => {});
  await su();
  const avisos = (await q(`select count(*)::int n from public.notificaciones where usuario_id = $1`, [uA]))[0].n;
  await como(coach, 'aal2');
  check(est === 'activo' && avisos >= 1, '(revisión) en pausa sigue activo en la base: el mensaje de su coach sí le avisa');
}
check(await falla(`insert into pausas (atleta_id, desde, hasta) values ($1, $2, $3)`, [L, mas(5), mas(4)]) && await falla(`insert into pausas (atleta_id, desde, motivo) values ($1, $2, 'siesta')`, [L, mas(5)])
  && await falla(`insert into pausas (atleta_id, desde, motivo) values ($1, $2, 'enfermedad')`, [L, mas(5)]) && await falla(`insert into pausas (atleta_id, desde, nota) values ($1, $2, $3)`, [L, mas(5), 'n'.repeat(201)])
  && await falla(`insert into pausas (atleta_id, desde, nota) values ($1, $2, ' ')`, [L, mas(5)]) && await falla(`insert into pausas (atleta_id, desde) values ($1, '1999-01-01')`, [L]),
'una pausa sin sentido, no (vuelta antes de empezar, motivo de fuera o de salud, nota larga o vacía)');
await q(`update pausas set hasta = $2 where id = $1`, [pa.id, mas(-1)]);
check(await destinatario(A), 'al acortarla hasta ayer («Terminar hoy»), vuelve a recibirlos');
await q(`update pausas set hasta = null where id = $1`, [pa.id]);
check(!(await destinatario(A)), 'sin fecha de vuelta, sigue en pausa');
await q(`update pausas set hasta = $2 where id = $1`, [pa.id, mas(0)]);
check(!(await destinatario(A)), 'el último día de pausa aún cuenta (vuelve al día siguiente)');

await como(uA);
const vistas = await q('select * from pausas');
check(vistas.length === 1 && vistas[0].nota === 'Pásalo bien' && await falla(`insert into pausas (atleta_id, desde) values ($1, $2)`, [A, hoyB]) && (await q(`update pausas set hasta = $2 where id = $1 returning id`, [pa.id, mas(30)])).length === 0
  && (await q(`delete from pausas where id = $1 returning id`, [pa.id])).length === 0 && (await q(`update atletas set estado = 'pausado' where id = $1 returning id`, [A]).catch(() => [])).length === 0,
'el atleta ve la suya (con el mensaje), y no pone, cambia ni quita pausas');
await como(uL);
check((await q('select * from pausas')).length === 1 && (await q('select * from pausas'))[0].atleta_id === L, 'cada atleta, solo las suyas');
await su();
await db.exec('reset role; set role anon;');
check(await falla('select * from pausas'), 'sin sesión, nada');
await como(coach, 'aal2');
const copia = (await q('select copia_privada() as c'))[0].c;
check(copia.pausas.length === 2 && copia.suplementos && copia.objetivos_propuestos, 'van en la copia completa del coach (con lo de la 076 y la 077)');
await su();
await q('delete from atletas where id = $1', [A]);
check((await q('select count(*)::int n from pausas where atleta_id = $1', [A]))[0].n === 0, 'se borran con la ficha del atleta');
const mig = lee('supabase/migraciones/078_pausas.sql'), m77 = lee('supabase/migraciones/077_suplementos.sql'), m10 = lee('supabase/migraciones/010_notificaciones.sql');
const permisos = (s) => s.slice(s.indexOf('revoke truncate, references, trigger'), s.indexOf('insert into public.fbe_migraciones'));
const vista = (s) => { const i = s.indexOf('create or replace view fbe_privado.destinatarios'); return s.slice(i, s.indexOf('revoke all on fbe_privado.destinatarios', i)); };
check(/if v > 78 then/.test(mig) && /numero = 77\) then/.test(mig) && /values \(78\)/.test(mig) && permisos(mig) === permisos(m77) && !/create or replace function public\.crear_recordatorios/.test(mig)
  && vista(mig).replace(/\n  -- \(078\)[^\n]*\n  and not exists \(select 1 from public\.pausas z[^;]*\)\);/, ';') === vista(m10), 'pide la 077; los permisos, los de la 077; la vista de destinatarios, la de la 010 sin quien está en pausa');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
