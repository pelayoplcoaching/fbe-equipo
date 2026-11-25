// FBE Esencial, migración 103, contra el esquema real (PGlite, con RLS): tu panel. Lo que Pelayo enciende, prueba en una
// cuenta o escribe (esencial_ajustes, con su registro); lo que cada atleta lee de ahí (esencial_ajustes_mios); «A quién
// escribir» con memoria; «¿Por qué te vas?»; lo que más se consulta (solo el recuento); la nota 'hablar'; el piloto semana a
// semana; el tope de avisos y «Tu lunes de FBE Esencial».
import { readFileSync } from 'node:fs';
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import * as datos from '../web/src/datos/api-esencial.js';
import { talCualDe, curvaPiloto } from '../web/src/logica/esencial-ajustes.js';
import { fijarAjustes, encendido, textoAjuste, respuestas } from '../web/src/logica/esencial-respuestas.js';
import { hoyISO, sumarDias, lunesDe, fechaMadrid } from '../web/src/logica/fechas.js';

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
const servidor = `${superusuario} set role service_role;`;
const hoy = hoyISO(), lunes = lunesDe(hoy);
await db.exec('reset role;');
await db.exec('delete from fbe_migraciones where numero > 103;');
await db.exec(SQL('103_esencial_panel.sql'));
await db.exec(SQL('103_esencial_panel.sql'));   // (se puede repetir)

console.log('La 103');
await db.exec(superusuario);
const priv = (await db.query(`select
  has_function_privilege('anon', 'public.esencial_ajustes_mios()', 'execute') a1, has_function_privilege('authenticated', 'public.esencial_ajustes_mios()', 'execute') u1,
  has_function_privilege('anon', 'public.esencial_contar_consulta(text)', 'execute') a2, has_function_privilege('anon', 'public.esencial_semanas_piloto()', 'execute') a3,
  has_function_privilege('authenticated', 'fbe_privado.esencial_tope(uuid, date)', 'execute') u4,
  has_function_privilege('authenticated', 'public.esencial_ajuste_registrar()', 'execute') u5, has_function_privilege('authenticated', 'public.esencial_ajuste_hora()', 'execute') u6,
  (select max(numero) from fbe_migraciones) n`)).rows[0];
check(!priv.a1 && priv.u1 && !priv.a2 && !priv.a3 && !priv.u4 && !priv.u5 && !priv.u6 && Number(priv.n) === 103, 'sin sesión, nada; el tope es privado; los disparadores no los llama nadie; la base queda en la 103');
{
  const de = (txt) => { const i = txt.lastIndexOf('create or replace function public.crear_recordatorios(p_ahora'); return txt.slice(i, txt.indexOf('\nend $$;', i)); };
  const f101 = de(SQL('101_esencial_viaje.sql')), f103 = de(SQL('103_esencial_panel.sql'));
  const sin = f103.replace(/ and not fbe_privado\.esencial_tope\([a-z_.]+, v_hoy\)/g, '');
  check(sin.startsWith(f101.slice(0, f101.lastIndexOf('  return v_n;'))) && (f103.match(/fbe_privado\.esencial_tope\(/g) || []).length === 11 && /'esencial_resumen:' \|\| v_lunes/.test(f103) && f103.endsWith('  return v_n;'),
    'crear_recordatorios es la de la 101 con el tope en sus once avisos de FBE Esencial y «Tu lunes» al final');
}

await b.auth.registrar('coach@fbe.test', 'contraseña-coach', 'Coach');
await q(`update perfiles set rol = 'coach' where id = $1`, [b.auth.sesion().user.id]);
const coachPerfil = b.auth.sesion().user.id;
const alta = {};
for (const n of ['ana', 'berta', 'carla']) alta[n] = await api.crearAtletaEsencial({ nombre: `${n} Prueba`, email: `${n}@test`, inicio: lunes });
const lucas = await api.crearAtleta({ nombre: 'Lucas Prueba', email: 'lucas@test', nivel: 'novato' });
const codLucas = await api.crearInvitacion(lucas.id);
const id = {};
const entrar = async (n, codigo) => {
  await b.auth.registrar(`${n}@test`, `clave-${n}@test`, n);
  await api.canjearCodigo(codigo);
  await api.darConsentimientos();
  id[n] = (await q('select id from atletas where email = $1', [`${n}@test`]))[0].id;
};
const como = (n) => (n === 'coach' ? b.auth.entrar('coach@fbe.test', 'contraseña-coach') : b.auth.entrar(`${n}@test`, `clave-${n}@test`));
for (const n of ['ana', 'berta', 'carla']) await entrar(n, alta[n].codigo);
await entrar('lucas', codLucas);

console.log('\nLo apagado, en tu mano (81-83 y 87)');
await como('coach');
await datos.ponerAjuste(b, 'enfermo', { encendido: true });
await datos.ponerAjuste(b, 'medico', { solo_atleta: id.ana });
await datos.ponerAjuste(b, 'nota_lunes:3', { texto: { texto: 'Mi nota de la semana 3.' } });
await datos.ponerAjuste(b, 'enfermo', { encendido: false });
await datos.ponerAjuste(b, 'enfermo', { encendido: true });
const filas = await datos.ajustes(b);
check(filas.length === 3 && filas.find((f) => f.clave === 'enfermo').encendido === true && filas.find((f) => f.clave === 'medico').solo_atleta === id.ana, 'Pelayo enciende «Estoy enfermo», prueba lo de su médico en la cuenta de Ana y escribe su nota del lunes 3');
const reg = await datos.registroAjustes(b);
check(reg.length === 5 && reg[0].clave === 'enfermo' && reg[0].despues.encendido === true && reg[0].antes.encendido === false, 'cada cambio, en el registro, con lo de antes y lo de después (el último, arriba)');
await datos.deshacerAjuste(b, reg[0]);
check((await datos.ajustes(b)).find((f) => f.clave === 'enfermo').encendido === false, '«Deshacer» vuelve a lo de antes');
await datos.ponerAjuste(b, 'enfermo', { encendido: true });
let e = await falla(() => b.insert('esencial_ajustes', [{ clave: 'Mal Clave!', encendido: true }]));
check(!!e, 'una clave que no vale no entra');
await como('ana');
const deAna = await datos.ajustesMios(b);
check(deAna.find((f) => f.clave === 'enfermo')?.encendido === true && deAna.find((f) => f.clave === 'medico')?.encendido === true && !('solo_atleta' in (deAna[0] || {})),
  'Ana lee lo suyo: «Estoy enfermo», encendido; lo de su médico, encendido solo para ella (sin saber que es una prueba)');
check(deAna.find((f) => f.clave === 'nota_lunes:3')?.texto?.texto === 'Mi nota de la semana 3.', 'y la nota del lunes 3, con el texto de Pelayo');
fijarAjustes(deAna);
check(encendido('enfermo') && encendido('medico') && !encendido('alarma') && textoAjuste('nota_lunes:3', 'texto') === 'Mi nota de la semana 3.', 'la app de Ana: lo encendido, encendido; lo demás, apagado; y la nota de Pelayo');
fijarAjustes([]);
check((await b.select('esencial_ajustes', {})).length === 0 && !!(await falla(() => b.insert('esencial_ajustes', [{ clave: 'alarma', encendido: true }]))), 'Ana no ve la tabla ni puede encender nada');
await como('berta');
check((await datos.ajustesMios(b)).find((f) => f.clave === 'medico')?.encendido === false, 'Berta: lo de su médico, apagado (no es su cuenta)');
await como('lucas');
check((await datos.ajustesMios(b)).length === 0, 'quien lleva seguimiento: nada');

console.log('\nLas respuestas editables (86)');
await como('coach');
await datos.ponerAjuste(b, 'respuesta:cobro', { texto: { r: 'Se cobra el lunes en que empiezas.' } });
await datos.ponerAjuste(b, 'respuesta_nueva:hijo', { texto: { cat: 'antes', q: '¿Puedo ir con mi hijo?', r: 'Sí, si tu gimnasio le deja entrar.' } });
await como('ana');
fijarAjustes(await datos.ajustesMios(b));
const rs = respuestas();
check(rs.find((x) => x.id === 'cobro').r === 'Se cobra el lunes en que empiezas.' && rs.find((x) => x.id === 'hijo')?.cat === 'antes' && rs.find((x) => x.id === 'hijo').suya, 'Pelayo corrige una respuesta y añade otra: Ana las ve así');
fijarAjustes([]);

console.log('\nA quién escribir, con memoria (90)');
await como('coach');
await datos.apuntarContacto(b, id.ana, 'diez días sin entrar');
const cs = await datos.contactos(b);
check(cs.length === 1 && cs[0].atleta_id === id.ana && cs[0].motivo === 'diez días sin entrar', 'Pelayo marca que ha escrito a Ana (y por qué)');
await como('ana');
check((await b.select('esencial_contactos', {})).length === 0 && !!(await falla(() => b.insert('esencial_contactos', [{ atleta_id: id.ana, motivo: 'x' }]))), 'Ana no lo ve ni lo puede apuntar');

console.log('\n¿Por qué te vas? (92)');
await como('berta');
await datos.apuntarBaja(b, id.berta, { motivo: 'tiempo', texto: 'Cambio de trabajo.' });
check(!!(await falla(() => datos.apuntarBaja(b, id.berta, { motivo: 'salud' }))), 'un motivo que no está en la lista no entra');
await como('carla');
check((await b.select('esencial_bajas', {})).length === 0, 'Carla no ve el motivo de Berta');
await como('coach');
const bs = await datos.bajas(b);
check(bs.length === 1 && bs[0].motivo === 'tiempo' && bs[0].nombre === 'berta Prueba', 'Pelayo lo ve, con su nombre');

console.log('\nLo que más se consulta (94)');
for (const n of ['ana', 'berta', 'ana']) { await como(n); await datos.contarConsulta(b, 'cobro'); }
await datos.contarConsulta(b, 'Mal clave');
await como('lucas');
await datos.contarConsulta(b, 'cobro');
await como('coach');
const cc = await datos.consultas(b);
check(cc.find((x) => x.clave === 'cobro')?.n === 3 && cc.length === 1, 'tres consultas a «¿Cuándo se me cobra?» (la de quien lleva seguimiento y una clave rara, fuera); solo el recuento');
await como('ana');
check((await b.select('esencial_consultas', {})).length === 0, 'Ana no ve el recuento');

console.log('\nHablar con Pelayo (93)');
await datos.anotar(b, id.ana, 'hablar', { datos: { motivo: 'estancado' } });
await como('coach');
check((await datos.hablaron(b)).some((x) => x.atleta_id === id.ana), 'Ana miró los programas con seguimiento: Pelayo lo ve');

console.log('\nEl piloto, semana a semana (88 y 89)');
await db.exec(superusuario);
const ej = (await db.query(`insert into ejercicios (nombre, grupos_musculares, tipo) values ('Prensa de prueba (103)', '{}', '{multiarticular}') returning id`)).rows[0].id;
for (const n of ['ana', 'berta']) {
  const bl = (await db.query(`insert into bloques (es_plantilla, atleta_id, nombre, estado, fecha_inicio, numero) values (false, $1, 'Primeras 4 semanas', 'activo', $2, 1) returning id`, [id[n], sumarDias(lunes, -14)])).rows[0].id;
  for (let k = 0; k < 3; k++) {
    const w = (await db.query(`insert into semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, $2, $3, 'programada') returning id`, [bl, k + 1, sumarDias(lunes, -14 + 7 * k)])).rows[0].id;
    for (let i = 1; i <= 2; i++) {
      const hecha = k < 2 && (n === 'ana' || i === 1);
      const s = (await db.query(`insert into sesiones (semana_id, orden, nombre, tipo, completada, fecha_realizada) values ($1, $2, $3, 'fuerza', $4, $5) returning id`, [w, i, `Día ${i}`, hecha, hecha ? sumarDias(lunes, -14 + 7 * k + (i === 1 ? 0 : 3)) : null])).rows[0].id;
      await db.query(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series, reps_min, reps_max, carga_sugerida_kg) values ($1, $2, 1, 2, 10, 12, $3)`, [s, ej, 40 + 2.5 * k]);
    }
  }
}
await como('ana');
check(!!(await falla(() => datos.semanasPiloto(b))), 'el piloto, solo el coach');
await como('coach');
const sp = await datos.semanasPiloto(b);
const deA = sp.filter((x) => x.atleta_id === id.ana);
check(sp.length === 6 && deA.length === 3 && deA[0].total === 2 && deA[0].hechas === 2 && deA[1].sube === 2 && deA[0].sube === 0, 'cada semana de cada uno: sus sesiones, las hechas y las subidas de carga');
const tc = talCualDe(sp, hoy);
check(tc.semanas === 4 && tc.talCual === 2 && tc.lista.find((x) => x.atleta_id === id.berta).incompletas === 2, `«Tal cual»: de 4 semanas terminadas, 2 tal cual (las de Ana); Berta, dos a medias`);
const cu = curvaPiloto(sp, hoy);
check(cu.puntos.length === 2 && cu.puntos[0].entrenaron === 2 && cu.puntos[0].total === 2, 'la curva: en sus dos primeras semanas entrenaron los dos');

console.log('\nEl tope de avisos (97) y tu lunes (98)');
await db.exec(superusuario);
const P = {};
for (const n of ['ana', 'berta']) {
  P[n] = (await db.query('select perfil_id from atletas where id = $1', [id[n]])).rows[0].perfil_id;
  await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true`, [P[n]]);
}
await db.query(`insert into notificaciones (usuario_id, tipo, titulo, clave, enviar_desde, caduca_en) values ($1, 'sesion_hoy', 'Hoy toca', 'esencial_prueba:1', now(), now() + interval '1 day')`, [P.ana]);
const tope = async (n) => (await db.query('select fbe_privado.esencial_tope($1, $2::date) t', [id[n], fechaMadrid()])).rows[0].t;
check((await tope('ana')) === false, 'sin tope encendido, nunca');
await db.query(`insert into esencial_ajustes (clave, encendido) values ('tope_dia', true)`);
check((await tope('ana')) === true && (await tope('berta')) === false, 'con «como mucho uno al día»: Ana, que ya tiene uno hoy, ha llegado; Berta, no');
await db.query(`delete from esencial_ajustes where clave = 'tope_dia'`);
await db.query(`insert into esencial_ajustes (clave, encendido, valor) values ('tope_semana', true, 1)`);
check((await tope('ana')) === true && (await tope('berta')) === false, 'con «como mucho uno a la semana», igual');
check((await db.query('select fbe_privado.esencial_tope($1, $2::date) t', [lucas.id, fechaMadrid()])).rows[0].t === false, 'a quien lleva seguimiento no le toca el tope');
await db.query(`delete from esencial_ajustes where clave = 'tope_semana'`);
// tu lunes: el lunes de esta semana a las 8:30
await db.query(`insert into preferencias_notificaciones (usuario_id, email, silencio_desde, silencio_hasta) values ($1, true, null, null) on conflict (usuario_id) do update set email = true`, [coachPerfil]);
const llamar = async (dia, h) => { await db.exec(servidor); await db.query('select public.crear_recordatorios($1::timestamptz)', [`${dia} ${h}:00 Europe/Madrid`]); await db.exec(superusuario); };
await llamar(lunes, '08:30');
check((await db.query(`select count(*)::int n from notificaciones where clave = $1`, [`esencial_resumen:${lunes}`])).rows[0].n === 0, 'tu lunes, apagado: no llega');
await db.query(`insert into esencial_ajustes (clave, encendido) values ('resumen_lunes', true)`);
await llamar(lunes, '08:30');
const res = (await db.query(`select usuario_id, titulo, cuerpo, url from notificaciones where clave = $1`, [`esencial_resumen:${lunes}`])).rows;
check(res.length === 1 && res[0].usuario_id === coachPerfil && res[0].titulo === 'Tu lunes de FBE Esencial' && /La semana pasada entrenaron 2 de 2/.test(res[0].cuerpo) && res[0].url === '#atletas',
  `encendido: el lunes a las 8:30, «Tu lunes de FBE Esencial» para Pelayo (${res[0]?.cuerpo})`);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
