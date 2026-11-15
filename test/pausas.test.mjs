// Pausar la asesoría (migración 078): las pausas que pone el coach, el estado del atleta que las sigue, la racha que
// no se rompe y los recordatorios que no salen. La lógica, la demo y la base (PGlite).
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
  && P.semanaEnPausa([{ desde: '2026-11-05', hasta: '2026-11-20' }], '2026-11-02') && !P.semanaEnPausa([{ desde: '2026-11-06', hasta: '2026-11-20' }], '2026-11-02'), 'una semana es de pausa si la pausa cubre cuatro días o más');
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
const ana = (await api.atletas()).find((a) => /Ana/.test(a.nombre)), ruben = (await api.atletas()).find((a) => /Rubén/.test(a.nombre));
check((await api.pausas078()) === true && (await api.pausas(ana.id)).length === 0 && ana.estado === 'activo', 'la demo tiene la 078; Ana, activa y sin pausas');
const rachaAntes = (await api.constancia(ana.id)).racha;
const p1 = await api.guardarPausa(ana.id, { desde: sumarDias(hoy, -10), hasta: sumarDias(hoy, 4), motivo: 'vacaciones', nota: 'Pásalo bien' });
const estadoDe = async (id) => (await api.atletas()).find((a) => a.id === id).estado;
check(p1.motivo === 'vacaciones' && await estadoDe(ana.id) === 'pausado', 'el coach la pone en pausa: su estado pasa a «pausado»');
const res = await api.resumenes();
check(res.find((r) => r.atleta_id === ana.id).estado === 'pausado' && !(res.find((r) => r.atleta_id === ana.id).alertas || []).some((a) => a.tipo === 'sin_entrenar' || a.tipo === 'cumplimiento'), 'en pausa no sale en las alertas del panel');
check((await api.constancia(ana.id)).pausas.length === 1 && (await api.constancia(ana.id)).racha >= rachaAntes, 'y su racha no baja por los días de pausa');
check(await lanza(() => api.guardarPausa(ana.id, { desde: hoy, hasta: sumarDias(hoy, -1), motivo: 'otro' })) && await lanza(() => api.guardarPausa(ana.id, { desde: hoy, motivo: 'siesta' })), 'una pausa sin sentido, no');
const p2 = await api.guardarPausa(ruben.id, { desde: sumarDias(hoy, 5), hasta: sumarDias(hoy, 12), motivo: 'trabajo' });
check(await estadoDe(ruben.id) === 'activo', 'una pausa que empieza otro día aún no cambia nada');
await b.auth.salir();
await b.auth.entrar('ana@fbe.demo', 'demo');
const mias = await api.pausas((await api.miAtleta()).id);
check(mias.length === 1 && mias[0].nota === 'Pásalo bien' && (await api.pausas(ruben.id)).length === 0 && await lanza(() => api.guardarPausa(ana.id, { desde: hoy, motivo: 'otro' }))
  && (await api.quitarPausa(p1.id), (await api.pausas(ana.id)).length === 1) && (await api.actualizar('pausas', p1.id, { hasta: sumarDias(hoy, 60) }).catch(() => null), (await api.pausas(ana.id))[0].hasta === sumarDias(hoy, 4)),
'el atleta ve la suya (con el mensaje de su coach), no las de otros, y no las pone, cambia ni quita');
await b.auth.salir();
await b.auth.entrar('pelayo@fbe.demo', 'demo');
await api.guardarPausa(ana.id, { id: p1.id, desde: sumarDias(hoy, -10), hasta: sumarDias(hoy, -1), motivo: 'vacaciones', nota: 'Pásalo bien' });
check(await estadoDe(ana.id) === 'activo' && (await api.pausas(ana.id)).length === 1, '«Terminar hoy» (último día, ayer): vuelve a activa y la pausa queda en su historial');
await api.guardarPausa(ana.id, { desde: hoy, motivo: 'otro' });
check(await estadoDe(ana.id) === 'pausado', 'otra, sin fecha de vuelta');
for (const x of await api.pausas(ana.id)) await api.quitarPausa(x.id);
check(await estadoDe(ana.id) === 'activo' && (await api.pausas(ana.id)).length === 0, 'al quitarle todas, vuelve');
await api.quitarPausa(p2.id);
check((await b.rpc('copia_privada', {})).pausas?.length === 0, 'van en la copia completa del coach');

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
const B = (await q(`insert into public.atletas (nombre, estado) values ('Baja', 'baja') returning id`))[0].id;
const V = (await q(`insert into public.atletas (nombre, estado) values ('Ya pausado', 'pausado') returning id`))[0].id;
const [{ d: hoyB }] = await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`);
const mas = (n) => sumarDias(hoyB, n);
const estado = async (id) => { await su(); const e = (await q('select estado from public.atletas where id = $1', [id]))[0].estado; await como(coach, 'aal2'); return e; };

await como(coach, 'aal2');
const [pa] = await q(`insert into pausas (atleta_id, desde, hasta, motivo, nota) values ($1, $2, $3, 'vacaciones', 'Pásalo bien') returning *`, [A, mas(-3), mas(4)]);
check(await estado(A) === 'pausado', 'el coach pone una pausa que cubre hoy: el atleta pasa a «pausado»');
await q(`insert into pausas (atleta_id, desde, hasta, motivo) values ($1, $2, $3, 'trabajo')`, [L, mas(2), mas(9)]);
check(await estado(L) === 'activo', 'una que empieza otro día no cambia nada todavía');
check(await falla(`insert into pausas (atleta_id, desde, hasta) values ($1, $2, $3)`, [L, mas(5), mas(4)]) && await falla(`insert into pausas (atleta_id, desde, motivo) values ($1, $2, 'siesta')`, [L, mas(5)])
  && await falla(`insert into pausas (atleta_id, desde, nota) values ($1, $2, $3)`, [L, mas(5), 'n'.repeat(201)]) && await falla(`insert into pausas (atleta_id, desde, nota) values ($1, $2, ' ')`, [L, mas(5)])
  && await falla(`insert into pausas (atleta_id, desde) values ($1, '1999-01-01')`, [L]), 'una pausa sin sentido, no (vuelta antes de empezar, motivo de fuera, nota larga o vacía)');
await q(`insert into pausas (atleta_id, desde, motivo) values ($1, $2, 'otro')`, [B, mas(-1)]);
check(await estado(B) === 'baja' && await estado(V) === 'pausado', 'ni los de baja cambian, ni quien ya estaba en «pausado» sin pausas apuntadas');
await q(`update pausas set hasta = $2 where id = $1`, [pa.id, mas(-1)]);
check(await estado(A) === 'activo', 'al acortarla hasta ayer («Terminar hoy»), vuelve a activo');
await q(`update pausas set hasta = null where id = $1`, [pa.id]);
check(await estado(A) === 'pausado', 'sin fecha de vuelta, sigue en pausa');
await q(`delete from pausas where id = $1`, [pa.id]);
check(await estado(A) === 'activo', 'al quitarle su única pausa, vuelve');

await como(uA);
check((await q('select * from pausas')).length === 0 && await falla(`insert into pausas (atleta_id, desde) values ($1, $2)`, [A, hoyB]), 'el atleta no se pone pausas');
await como(coach, 'aal2');
const [pb] = await q(`insert into pausas (atleta_id, desde, hasta, motivo, nota) values ($1, $2, $3, 'personal', 'Ánimo') returning *`, [A, mas(-1), mas(1)]);
await como(uA);
const vistas = await q('select * from pausas');
check(vistas.length === 1 && vistas[0].nota === 'Ánimo' && (await q(`update pausas set hasta = $2 where id = $1 returning id`, [pb.id, mas(30)])).length === 0 && (await q(`delete from pausas where id = $1 returning id`, [pb.id])).length === 0
  && await falla('select fbe_privado.aplicar_pausas(null)') && await falla('select public.pausa_aplicar()'), 've la suya (con el mensaje), no las de otros, y no la cambia ni la quita');
await como(uL);
check((await q('select * from pausas')).length === 1, 'cada atleta, solo las suyas');
await su();
await db.exec('reset role; set role anon;');
check(await falla('select * from pausas'), 'sin sesión, nada');

// Cada día, en la pasada de los recordatorios: las que empiezan y las que acaban
await su();
await q(`update pausas set desde = $2, hasta = $3 where id = $1`, [pb.id, mas(-5), mas(-1)]);   // (el trigger ya lo devuelve)
await q(`update public.atletas set estado = 'pausado' where id = $1`, [A]);                      // como si aún no hubiera pasado el día
await q(`update pausas set desde = $2 where atleta_id = $1`, [L, mas(0)]);
await q(`update public.atletas set estado = 'activo' where id = $1`, [L]);
await q('select fbe_privado.aplicar_pausas(null)');
check((await q('select estado from public.atletas where id = $1', [A]))[0].estado === 'activo' && (await q('select estado from public.atletas where id = $1', [L]))[0].estado === 'pausado'
  && (await q('select estado from public.atletas where id = $1', [V]))[0].estado === 'pausado' && (await q('select estado from public.atletas where id = $1', [B]))[0].estado === 'baja',
'la pasada diaria devuelve a quien acabó su pausa ayer y pone en pausa a quien la empieza hoy (los demás, como estaban)');
await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [uL]);
check((await q('select count(*)::int n from fbe_privado.destinatarios where atleta_id = $1', [L]))[0].n === 0, 'en pausa no recibe recordatorios (no está entre los destinatarios)');
const copia = await (async () => { await como(coach, 'aal2'); return (await q('select copia_privada() as c'))[0].c; })();
check(copia.pausas.length === 3 && copia.suplementos && copia.objetivos_propuestos, 'van en la copia completa del coach (con lo de la 076 y la 077)');
await su();
await q('delete from atletas where id = $1', [A]);
check((await q('select count(*)::int n from pausas where atleta_id = $1', [A]))[0].n === 0, 'se borran con la ficha del atleta');
const mig = lee('supabase/migraciones/078_pausas.sql'), m77 = lee('supabase/migraciones/077_suplementos.sql');
const cuerpo = (s) => { const i = s.indexOf('create or replace function public.crear_recordatorios_apuntes'); return s.slice(i, s.indexOf('end $$;', s.indexOf('return v_n;', i))); };
check(/if v > 78 then/.test(mig) && /numero = 77\) then/.test(mig) && /values \(78\)/.test(mig)
  && cuerpo(mig).replace(/  -- \(078\)[^\n]*\n  begin\n    perform fbe_privado\.aplicar_pausas\(null\);\n  exception when others then\n[^\n]*\n  end;\n/, '') === cuerpo(m77), 'pide la 077; la pasada de recordatorios, la de la 077 más las pausas');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
