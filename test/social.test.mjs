// La parte social del equipo (tanda «social», migración 053): la migración en un Postgres local (PGlite), la lógica pura
// (logica/social.js) y la api con el modo demo (backend-memoria).
// Uso: node test/social.test.mjs
import { lunesDe, sumarDias } from '../web/src/logica/fechas.js';
import { mismaSesion, loMejorDeLaSemana, albumPorMeses, textoIntencion, textoDuelo, resultadoDuelo, huellaFrases, esCumpleHoy,
  limpiarNotaIntencion, candidatosDuelo, INSIGNIAS_SOCIALES } from '../web/src/logica/social.js';
import { INSIGNIAS, insigniasDe } from '../web/src/logica/comunidad.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La lógica pura');
const hoy = '2026-11-09';
const posts = [
  { id: 'p1', tipo: 'entreno', autor_id: 'u1', autor: { nombre: 'Rubén M.' }, creado_en: '2026-11-09T10:00:00Z', resumen: { nombre: 'Pierna A' }, reacciones: { aplauso: ['a', 'b'] }, comentarios: 1 },
  { id: 'p2', tipo: 'entreno', autor_id: 'u2', autor: { nombre: 'Carlos V.' }, creado_en: '2026-11-09T12:00:00Z', resumen: { nombre: 'Pierna A' }, reacciones: {}, comentarios: 0 },
  { id: 'p3', tipo: 'entreno', autor_id: 'u3', autor: { nombre: 'Lucía F.' }, creado_en: '2026-11-08T12:00:00Z', resumen: { nombre: 'Pierna A' }, reacciones: { fuego: ['a'] }, comentarios: 0 },
  { id: 'p4', tipo: 'post', autor_id: 'u1', autor: { nombre: 'Rubén M.' }, creado_en: '2026-11-05T12:00:00Z', texto: 'Hola', reacciones: { aplauso: ['a', 'b', 'c'], fuego: ['d'] }, comentarios: 4, fotos: ['x/1.jpg', 'x/2.jpg'] },
  { id: 'p5', tipo: 'logro', autor_id: 'u2', autor: { nombre: 'Carlos V.' }, creado_en: '2026-10-28T12:00:00Z', reacciones: {}, comentarios: 0, fotos: ['y/3.jpg'] },
  { id: 'p6', tipo: 'entreno', autor_id: 'u1', autor: { nombre: 'Rubén M.' }, creado_en: '2026-11-09T18:00:00Z', resumen: { nombre: 'Torso B' }, reacciones: {}, comentarios: 0 },
];
const grupos = mismaSesion(posts, hoy);
check(grupos.length === 1 && grupos[0].nombre === 'Pierna A' && grupos[0].ids.join() === 'p1,p2' && grupos[0].nombres.join() === 'Rubén M.,Carlos V.', 'misma sesión: dos han hecho Pierna A hoy (la de ayer y Torso B, no)');
check(mismaSesion([posts[0], { ...posts[1], autor_id: 'u1' }], hoy).length === 0, 'la misma persona dos veces no cuenta');
const mejor = loMejorDeLaSemana(posts, '2026-11-09', { nuevos: [{ nombre: 'Lucía F.' }], records: 3 });
check(mejor && mejor.aplaudida?.id === 'p4' && mejor.comentada?.id === 'p4' && mejor.entrenos === 1 && mejor.records === 3 && mejor.nuevos[0] === 'Lucía F.' && mejor.desde === '2026-11-02' && mejor.hasta === '2026-11-08', 'lo mejor de la semana pasada: la más aplaudida, la más comentada, los entrenos, los récords y los nuevos');
check(loMejorDeLaSemana(posts, '2026-11-12') === null && loMejorDeLaSemana([], '2026-11-09') === null, 'solo lunes y martes, y solo si hubo algo');
const album = albumPorMeses(posts);
check(album.length === 2 && album[0].mes === '2026-11' && album[0].titulo === 'Noviembre de 2026' && album[0].fotos.length === 2 && album[0].fotos[0].post === 'p4' && album[1].fotos[0].ruta === 'y/3.jpg', 'el álbum por meses, de la más reciente');
check(textoIntencion({ fecha: hoy, hora: '18:00:00', nota: 'Gimnasio del barrio' }, hoy) === 'Hoy a las 18:00 · Gimnasio del barrio' && textoIntencion({ fecha: '2026-11-10', hora: null }, hoy) === 'Mañana', 'cuándo entrena, en palabras');
check(limpiarNotaIntencion('  en el   Retiro ') === 'en el Retiro' && limpiarNotaIntencion('a'.repeat(50)).length === 40 && limpiarNotaIntencion(null) === '', 'la nota de la intención, limpia y corta');
const d1 = { semana: '2026-11-09', estado: 'aceptado', soy_retador: true, rival_nombre: 'Carlos V.', mias: 2, suyas: 1, acabado: false };
check(textoDuelo(d1, hoy) === 'Vas 2 a 1 con Carlos V.' && resultadoDuelo({ ...d1, acabado: true }) === 'ganado' && resultadoDuelo({ ...d1, acabado: true, mias: 1 }) === 'empate' && resultadoDuelo({ ...d1, acabado: true, mias: 0 }) === 'perdido' && resultadoDuelo(d1) === null, 'el duelo: cómo va y, al acabar, ganado, perdido o empate');
check(textoDuelo({ ...d1, suyas: null }, hoy) === 'Llevas 2 en el duelo con Carlos V.' && resultadoDuelo({ ...d1, suyas: null, acabado: true }) === null, 'si el rival ya no está, sus sesiones no salen ni hay resultado');
check(textoDuelo({ ...d1, estado: 'pendiente', soy_retador: false }, hoy) === 'Carlos V. te reta esta semana' && textoDuelo({ ...d1, estado: 'pendiente', semana: '2026-11-16' }, hoy) === 'Has retado a Carlos V. para la semana que viene', 'pendiente: quién reta a quién, y para cuándo');
check(candidatosDuelo([{ perfil_id: 'a', nombre: 'A' }, { perfil_id: 'b', nombre: 'B' }, { perfil_id: 'yo', nombre: 'Yo' }], 'yo', [{ rival: 'a', semana: '2026-11-09', estado: 'aceptado' }], '2026-11-09').map((x) => x.perfil_id).join() === 'b', 'a quién puedo retar: ni a mí ni a quien ya tengo esa semana');
const fr = huellaFrases({ animos_dados: 12, animos_recibidos: 3, bienvenidas: 2, comentarios: 7, reacciones: 30, quedadas: 1, ahijados: 0, elegido: 1, semanas_animando: 3, duelos_ganados: 2 });
check(fr.length >= 6 && fr[0].includes('12 ánimos') && fr.some((x) => x.includes('3 semanas seguidas')) && fr.some((x) => x.includes('compañero de la semana')) && !fr.some((x) => x.includes('acompañ')), 'tu huella en frases (lo que es cero, no sale)');
check(esCumpleHoy({ cumple_mes: 11, cumple_dia: 9 }, hoy) && !esCumpleHoy({ cumple_mes: 11, cumple_dia: 10 }, hoy) && !esCumpleHoy(null, hoy), '¿es hoy su cumpleaños?');
check(INSIGNIAS_SOCIALES.length === 4 && INSIGNIAS.some(([k]) => k === 'animador_25') && insigniasDe([{ clave: 'padrino_1', valor: 1, meta: 1 }]).find((x) => x.clave === 'padrino_1')?.conseguida, 'las cuatro insignias sociales van con las demás');

console.log('\nLa migración 053 (PGlite)');
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
const uno = async (sql, params = []) => (await q(sql, params))[0]?.r;
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
const ids = {};
const atletas = {};
for (const [k, n] of [['a', 'Ana'], ['b', 'Bea'], ['c', 'Cris'], ['d', 'Dani']]) {
  ids[k] = await usuario(`${k}@x.test`);
  atletas[k] = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ($1, $2, 'activo') returning id`, [n, ids[k]]))[0].id;
  await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true)`, [ids[k]]);
}
const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`))[0].d;
const lunesM = lunesDe(hoyM);
const dow = new Date(hoyM + 'T12:00:00Z').getUTCDay() || 7;
// Sesiones de esta semana: Ana 2 (ayer y hoy, o lunes y hoy), Bea 1
const sesion = async (k, fecha, nombre = 'Pierna A') => {
  const bl = (await q(`insert into public.bloques (atleta_id, nombre, estado, fecha_inicio) values ($1, 'B', 'activo', $2) returning id`, [atletas[k], lunesM]))[0].id;
  const se = (await q(`insert into public.semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, lunesM]))[0].id;
  await q(`insert into public.sesiones (semana_id, orden, nombre, completada, fecha_realizada) values ($1, 1, $2, true, $3)`, [se, nombre, fecha]);
};
await sesion('a', lunesM); if (dow > 1) await sesion('a', hoyM, 'Torso A'); else await sesion('a', lunesM, 'Torso A');
await sesion('b', hoyM);
await como(coach);
await q(`update public.comunidad_ajustes set activa = true`);
const version = (await q(`select public.comunidad_version() v`))[0].v;
const normas = (await q(`select public.comunidad_normas_version() v`))[0].v;
for (const k of ['a', 'b', 'c', 'd']) { await como(ids[k]); await q(`select public.comunidad_unirme($1, $2, $3)`, [`${k.toUpperCase()}. Equipo`, version, normas]); }
await su();
// Ana y Bea llevan 70 días dentro; Cris 3; Dani 20
await q(`update public.comunidad_miembros set creado_en = now() - interval '70 days', entrado_en = now() - interval '70 days' where atleta_id in ($1, $2)`, [atletas.a, atletas.b]);
await q(`update public.comunidad_miembros set creado_en = now() - interval '3 days', entrado_en = now() - interval '3 days' where atleta_id = $1`, [atletas.c]);
await q(`update public.comunidad_miembros set creado_en = (((now() at time zone 'Europe/Madrid')::date - 20) + time '12:00') at time zone 'Europe/Madrid', entrado_en = (((now() at time zone 'Europe/Madrid')::date - 20) + time '12:00') at time zone 'Europe/Madrid' where atleta_id = $1`, [atletas.d]);

await como(ids.a);
check(await falla(`select * from public.comunidad_duelos where false`) === false && (await q(`select * from public.comunidad_votos_semana`)).length === 0, 'las tablas nuevas se leen por sus políticas (vacías para quien no tiene nada)');
check(await falla(`insert into public.comunidad_duelos (de, para, semana) values ($1, $2, $3)`, [ids.a, ids.b, lunesM]) && await falla(`insert into public.comunidad_intenciones (perfil_id, fecha) values ($1, $2)`, [ids.a, hoyM]), 'nadie escribe en ellas a mano');

// 1. Ajustes y cumpleaños
const aj = await uno(`select public.comunidad_social_ajustes(true, null) as r`);
check(aj.cumple_equipo === true && aj.ver_ausencia === false, 'enciende el cumpleaños en el equipo');
await su();
const [mes, dia] = [Number(hoyM.slice(5, 7)), Number(hoyM.slice(8, 10))];
await q(`insert into public.personal_atleta (atleta_id, cumple_mes, cumple_dia) values ($1, $2, $3)`, [atletas.a, mes, dia]);
await q(`insert into public.personal_atleta (atleta_id, cumple_mes, cumple_dia) values ($1, $2, $3)`, [atletas.b, mes, dia]);
await como(ids.b);
let cumples = await q(`select * from public.comunidad_cumples()`);
check(cumples.length === 1 && cumples[0].nombre === 'A. Equipo' && cumples[0].soy_yo === false, 'Bea ve el cumple de Ana (el suyo no: no lo ha encendido)');
await q(`select public.comunidad_social_ajustes(true, true)`);
cumples = await q(`select * from public.comunidad_cumples()`);
check(cumples.length === 2 && cumples.some((x) => x.soy_yo), 'al encenderlo, también el suyo');

// 2. Ánimo con palabras
check(await falla(`select public.comunidad_animar($1, $2)`, [ids.a, 'x'.repeat(81)]), 'las palabras del ánimo, hasta 80');
await q(`select public.comunidad_animar($1, $2)`, [ids.a, '  ¡Feliz   cumple!  ']);
await su();
const an = (await q(`select texto from public.comunidad_animos where de = $1 and para = $2`, [ids.b, ids.a]))[0];
const notaAn = (await q(`select cuerpo from public.notificaciones where usuario_id = $1 and clave like 'comunidad_animo:%' order by creado_en desc limit 1`, [ids.a]))[0];
check(an.texto === '¡Feliz cumple!' && notaAn.cuerpo === '«¡Feliz cumple!»', 'el ánimo guarda las palabras (limpias) y van en el aviso');
await como(ids.c);
await q(`select public.comunidad_animar($1)`, [ids.a]);
await su();
check((await q(`select texto from public.comunidad_animos where de = $1`, [ids.c]))[0].texto === null, 'sin palabras, como siempre');

// 3. Encuestas de los atletas y citar
await como(ids.a);
const [enc] = await q(`insert into public.comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Sábado o domingo?', '{"opciones":["Sábado","Domingo"]}') returning id, encuesta, atleta_id`);
check(enc.encuesta.opciones.length === 2 && enc.atleta_id === atletas.a, 'Ana publica una encuesta');
await su();
check((await q(`select count(*)::int n from public.notificaciones where clave = $1`, ['comunidad_aviso:' + enc.id]))[0].n === 0, 'la encuesta de un atleta no hace sonar todos los móviles (la del coach, sí)');
await como(ids.a);
check(await falla(`insert into public.comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Otra?', '{"opciones":["Sí","No"]}')`), 'una al día');
check(await falla(`insert into public.comunidad_posts (tipo, texto, encuesta) values ('encuesta', '¿Una?', '{"opciones":["Sola"]}')`) && await falla(`insert into public.comunidad_posts (tipo, texto) values ('aviso', 'No')`), 'con sus reglas (2 a 4 opciones); los avisos siguen siendo del coach');
await como(ids.b);
check((await q(`select public.comunidad_votar($1, 1) v`, [enc.id]))[0].v === 1, 'Bea vota en la encuesta de Ana');
const [cita] = await q(`insert into public.comunidad_posts (tipo, texto, cita_post_id) values ('post', 'Yo digo domingo', $1) returning id, cita_post_id`, [enc.id]);
check(cita.cita_post_id === enc.id, 'y la cita en una publicación suya');
check(await falla(`insert into public.comunidad_posts (tipo, texto, cita_post_id) values ('post', 'Me cito', $1)`, [cita.id]), 'la propia, no');
await como(ids.a);
check(await falla(`insert into public.comunidad_posts (tipo, texto, cita_post_id) values ('post', 'Pues yo sábado', $1)`, [cita.id]) === false, 'citar una cita vale');
check(await falla(`insert into public.comunidad_posts (tipo, texto, cita_post_id) values ('post', 'Me cito', $1)`, [enc.id]) && await falla(`insert into public.comunidad_posts (tipo, texto, cita_post_id) values ('post', '', $1)`, [cita.id]), 'ni la propia ni sin texto');
await su();
check((await q(`select count(*)::int n from public.notificaciones where usuario_id = $1 and clave = 'comunidad_cita:' || $2`, [ids.a, cita.id]))[0].n === 1, 'a Ana le llega «ha compartido tu publicación»');

// 4. Quedadas de atletas
await como(ids.a);
const [qd] = await q(`insert into public.comunidad_eventos (titulo, empieza_en, lugar, plazas, creado_por) values ('Pierna juntos', now() + interval '2 days', 'Gimnasio', 4, $1) returning id, creado_por`, [ids.a]);
check(qd.creado_por === ids.a, 'Ana propone una quedada');
const [ajena] = await q(`insert into public.comunidad_eventos (titulo, empieza_en, lugar, creado_por) values ('Dos', now() + interval '2 days', 'X', $1) returning creado_por`, [ids.b]);
check(ajena.creado_por === ids.a && await falla(`insert into public.comunidad_eventos (titulo, empieza_en, lugar, plazas, creado_por) values ('Grande', now() + interval '2 days', 'X', 100, $1)`, [ids.a]), 'la base la firma siempre con quien la propone; más de 30 plazas, no');
check((await q(`select va from public.comunidad_evento_asistentes where evento_id = $1 and perfil_id = $2`, [qd.id, ids.a]))[0]?.va === true, 'quien la propone, va');
await q(`insert into public.comunidad_eventos (titulo, empieza_en, lugar, creado_por) values ('Tres', now() + interval '4 days', 'X', $1)`, [ids.a]);
check(await falla(`insert into public.comunidad_eventos (titulo, empieza_en, lugar, creado_por) values ('Cuatro', now() + interval '5 days', 'X', $1)`, [ids.a]), 'como mucho tres abiertas');
await como(ids.b);
check(await falla(`update public.comunidad_eventos set titulo = 'Cambiada' where id = $1`, [qd.id]) || (await q(`select titulo from public.comunidad_eventos where id = $1`, [qd.id]))[0].titulo === 'Pierna juntos', 'Bea no la cambia');
await q(`select public.comunidad_evento_responder($1, true)`, [qd.id]);
await como(ids.a);
await q(`update public.comunidad_eventos set cancelado_en = now() where id = $1`, [qd.id]);
await su();
const notaQ = (await q(`select cuerpo from public.notificaciones where usuario_id = $1 and clave = 'comunidad_evento_cancelado:' || $2`, [ids.b, qd.id]))[0];
check(notaQ?.cuerpo === 'A. Equipo ha cancelado la quedada. Míralo en Equipo.' && (await q(`select count(*)::int n from public.notificaciones where usuario_id = $1 and clave = 'comunidad_evento_cancelado:' || $2`, [ids.a, qd.id]))[0].n === 0, 'al cancelarla, a Bea le llega quién la cancela (a Ana, no)');
await como(coach);
await q(`update public.comunidad_eventos set cancelado_en = now() where titulo = 'Dos'`);
check((await q(`select count(*)::int n from public.comunidad_eventos where cancelado_en is not null`))[0].n === 2, 'el coach puede cancelar una quedada de un atleta');

// 5. Duelos
await como(ids.a);
const duelo = await uno(`select public.comunidad_duelo_proponer($1) as r`, [ids.b]);
check(/^[0-9a-f-]{36}$/.test(duelo), 'Ana reta a Bea');
check(await falla(`select public.comunidad_duelo_proponer($1)`, [ids.b]) && await falla(`select public.comunidad_duelo_proponer($1)`, [ids.a]), 'ni dos veces la misma semana ni a sí misma');
let mios = await q(`select * from public.comunidad_duelos_mios()`);
check(mios.length === 1 && mios[0].estado === 'pendiente' && mios[0].soy_retador && mios[0].rival_nombre === 'B. Equipo', 'lo ve como pendiente');
await como(ids.c);
check((await q(`select * from public.comunidad_duelos_mios()`)).length === 0 && await falla(`select public.comunidad_duelo_responder($1, true)`, [duelo]), 'Cris ni lo ve ni lo acepta');
await como(ids.b);
check((await q(`select public.comunidad_duelo_responder($1, true) r`, [duelo]))[0].r === 'aceptado', 'Bea lo acepta');
mios = await q(`select * from public.comunidad_duelos_mios()`);
const esperadoAna = dow === 7 ? 0 : 2, esperadoBea = dow === 7 ? 0 : 1;
check(mios[0].estado === 'aceptado' && !mios[0].soy_retador && mios[0].rival_nombre === 'A. Equipo' && mios[0].acabado === false
  && (dow === 7 || (mios[0].mias === esperadoBea && mios[0].suyas === esperadoAna)), `cada uno ve sus sesiones y las del rival (${esperadoBea} a ${esperadoAna}; en domingo el duelo es de la semana que viene)`);
await como(coach);
check((await q(`select * from public.comunidad_duelos_mios(true)`)).length === 1 && (await q(`select * from public.comunidad_duelos`)).length === 1, 'el coach ve todos los duelos');
await como(ids.a);
const d2 = await uno(`select public.comunidad_duelo_proponer($1, true) as r`, [ids.c]);
await q(`select public.comunidad_duelo_retirar($1)`, [d2]);
check((await q(`select * from public.comunidad_duelos_mios()`)).length === 1, 'un duelo propuesto se puede retirar mientras está pendiente');
await su();
await q(`update public.comunidad_miembros set sin_ranking = true where atleta_id = $1`, [atletas.d]);
await como(ids.a);
check(await falla(`select public.comunidad_duelo_proponer($1)`, [ids.d]), 'no se reta a quien no sale en el ranking');

// 6. Intenciones
const it = await uno(`select public.comunidad_intencion($1::date, '18:30', '  en el   gym ') as r`, [hoyM]);
check(it.hora === '18:30:00' && it.nota === 'en el gym', 'Ana dice que hoy entrena a las 18:30');
check(await falla(`select public.comunidad_intencion($1::date + 2)`, [hoyM]) && await falla(`select public.comunidad_intencion($1::date, null, $2)`, [hoyM, 'x'.repeat(41)]), 'hoy o mañana, y la nota corta');
await como(ids.b);
await q(`select public.comunidad_intencion($1::date + 1, null, null)`, [hoyM]);
let ints = await q(`select * from public.comunidad_intenciones()`);
check(ints.length === 2 && ints[0].nombre === 'A. Equipo' && ints[0].soy_yo === false && ints[1].soy_yo === true && ints[1].hora === null, 'los del equipo ven quién entrena hoy y mañana');
await q(`select public.comunidad_intencion(null)`);
check((await q(`select * from public.comunidad_intenciones()`)).length === 1, 'y cada uno quita la suya');

// 7. Padrinos
let pl = await uno(`select public.comunidad_padrinos_lista() as r`);
check(pl.puedo === true && pl.sin_padrino.length === 1 && pl.sin_padrino[0].nombre === 'C. Equipo' && pl.vigentes.length === 0, 'Bea (70 días) puede acompañar; Cris (3 días) no tiene padrino aún; Dani (20) ya no cuenta como nuevo');
check(await falla(`select public.comunidad_apadrinar($1)`, [ids.d]), 'a quien lleva más de dos semanas, no');
await q(`select public.comunidad_apadrinar($1)`, [ids.c]);
pl = await uno(`select public.comunidad_padrinos_lista() as r`);
check(pl.vigentes.length === 1 && pl.vigentes[0].padrino_nombre === 'B. Equipo' && pl.vigentes[0].nuevo_nombre === 'C. Equipo' && pl.sin_padrino.length === 0, 'Bea acompaña a Cris 30 días');
await como(ids.a);
check((await q(`select * from public.comunidad_padrinos`)).length === 0, 'la tabla de padrinos, cada uno solo las suyas (Ana no ve la de Bea y Cris)');
check(await falla(`select public.comunidad_apadrinar($1)`, [ids.c]), 'Cris ya tiene quien le acompañe');
await como(ids.c);
check((await uno(`select public.comunidad_padrinos_lista() as r`)).puedo === false && await falla(`select public.comunidad_apadrinar($1)`, [ids.d]), 'Cris, recién llegada, no apadrina');
await su();
check((await q(`select count(*)::int n from public.notificaciones where usuario_id = $1 and clave like 'comunidad_padrino:%'`, [ids.c]))[0].n === 1, 'a Cris le llega quién le acompaña');
await como(ids.c);
await q(`select public.comunidad_padrino_quitar()`);
check((await uno(`select public.comunidad_padrinos_lista() as r`)).vigentes.length === 0, 'y puede soltarse');

// 8. Compañero de la semana
await como(ids.a);
await q(`select public.comunidad_votar_companero($1)`, [ids.b]);
check(await falla(`select public.comunidad_votar_companero($1)`, [ids.a]), 'no se vota uno mismo');
await como(ids.c);
await q(`select public.comunidad_votar_companero($1)`, [ids.b]);
let cs = await uno(`select public.comunidad_companero_semana() as r`);
check(cs.mi_voto === ids.b && Number(cs.votos) === 2 && cs.elegidos.length === 0, 'esta semana van 2 votos; el elegido sale el lunes que viene');
await su();
await q(`update public.comunidad_votos_semana set semana = semana - 7`);
await como(ids.a);
cs = await uno(`select public.comunidad_companero_semana() as r`);
check(cs.elegidos.length === 1 && cs.elegidos[0].nombre === 'B. Equipo' && Number(cs.elegidos[0].votos) === 2 && cs.mi_voto === null, 'la semana pasada el equipo eligió a Bea (2 votos)');
check((await q(`select * from public.comunidad_votos_semana`)).length === 1, 'cada uno solo ve su voto');
await como(ids.b);
check(Number((await uno(`select public.comunidad_companero_semana() as r`)).mis_veces) === 1, 'Bea sabe que la han elegido una vez');

// 9. Huella e insignias
const hu = await uno(`select public.comunidad_huella() as r`);
check(Number(hu.animos_dados) === 1 && Number(hu.animos_recibidos) === 0 && Number(hu.ahijados) === 1 && Number(hu.elegido) === 1 && Number(hu.semanas_animando) === 1 && Number(hu.quedadas) === 0, 'la huella de Bea: 1 ánimo, 1 ahijada, elegida 1 vez, 1 semana animando');
const huA = await uno(`select public.comunidad_huella($1) as r`, [ids.a]);
check(Number(huA.animos_recibidos) === 2 && Number(huA.ahijados) === 0, 'y la de Ana, que ve cualquiera del equipo');
const ins = await q(`select * from public.comunidad_insignias()`);
check(ins.some((x) => x.perfil_id === ids.b && x.clave === 'padrino_1' && x.valor === 1) && ins.some((x) => x.perfil_id === ids.b && x.clave === 'anfitrion_3'), 'las insignias sociales salen con las demás');

// 10. Quién necesita un ánimo
await como(ids.c);
check((await q(`select * from public.comunidad_sin_entrenar()`)).length === 0, 'sin encenderlo, nadie sale');
await como(ids.d);
await q(`select public.comunidad_social_ajustes(null, true)`);
await como(ids.c);
let sin = await q(`select * from public.comunidad_sin_entrenar()`);
check(sin.length === 1 && sin[0].nombre === 'D. Equipo' && sin[0].dias === 20, 'Dani lo enciende y, sin sesiones desde que entró (20 días), sale');
await como(ids.d);
check((await q(`select * from public.comunidad_sin_entrenar()`)).length === 0, 'uno mismo no se ve');

// 11. Salir borrando
await como(ids.b);
await q(`select public.comunidad_salir(true)`);
await su();
check((await q(`select count(*)::int n from public.comunidad_duelos where $1 in (de, para)`, [ids.b]))[0].n === 0 && (await q(`select count(*)::int n from public.comunidad_votos_semana where $1 in (de, para)`, [ids.b]))[0].n === 0
  && (await q(`select count(*)::int n from public.comunidad_animos where de = $1`, [ids.b]))[0].n === 0, 'al salir borrando, se van sus duelos, votos y ánimos');
await como(ids.a);
const md = await uno(`select public.comunidad_mis_datos() as r`);
check(Array.isArray(md.duelos) && md.intencion?.nota === 'en el gym' && Array.isArray(md.votos_companero) && md.quedadas_propuestas.length === 3 && 'veces_elegido' in md, 'mis datos incluye lo nuevo');
check(await falla(`select public.comunidad_huella()`) === false && (await q(`select proname from pg_proc where proname in ('reloj_estado') limit 1`)).length === 0, 'y la 053 vale sin la 052 (del reloj)');

// 12. Lo que pidió la revisión de la 053
await su();
await q(`update public.comunidad_moderacion set palabras = '{palabrota}'`);
await como(ids.c);
check(await falla(`select public.comunidad_animar($1, $2)`, [ids.d, 'Vamos palabrota']), 'el filtro de palabras vale también para las palabras del ánimo');
check(await falla(`select public.comunidad_intencion($1::date, null, $2)`, [hoyM, 'palabrota']), 'y para la nota de «hoy entreno»');
check(await falla(`insert into public.comunidad_eventos (titulo, lugar, empieza_en) values ('Quedada palabrota', 'Parque', now() + interval '2 days')`), 'y para las quedadas');
await su();
await q(`update public.comunidad_moderacion set palabras = '{}'`);
await q(`update public.comunidad_miembros set sin_ranking = false where atleta_id = $1`, [atletas.d]);
await como(ids.c);
const dCD = await uno(`select public.comunidad_duelo_proponer($1, true) as r`, [ids.d]);
await como(ids.d);
await q(`select public.comunidad_duelo_responder($1, true)`, [dCD]);
await q(`select public.comunidad_intencion($1::date, null, null)`, [hoyM]);
const [qdR] = await q(`insert into public.comunidad_eventos (titulo, lugar, empieza_en) values ('Rodaje', 'Parque', now() + interval '3 days') returning id, plazas`);
check(qdR.plazas === 30, 'una quedada de atleta sin plazas se queda en 30');
await q(`select public.comunidad_ajustar(null, true)`);
await su();
check((await q(`select count(*)::int n from public.comunidad_duelos where id = $1`, [dCD]))[0].n === 0, 'al salir del ranking, sus duelos vivos se van');
await q(`update public.comunidad_miembros set bloqueado = true, salido_en = now() where atleta_id = $1`, [atletas.d]);
check((await q(`select count(*)::int n from public.comunidad_intenciones where perfil_id = $1`, [ids.d]))[0].n === 0
  && (await q(`select cancelado_en from public.comunidad_eventos where id = $1`, [qdR.id]))[0].cancelado_en !== null, 'si el coach le saca, su «hoy entreno» se va y sus quedadas abiertas se cancelan');

console.log('\nLa api con el modo demo');
const { crearBackendMemoria } = await import('../web/src/datos/backend-memoria.js');
const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');
const { crearApi } = await import('../web/src/datos/api.js');
globalThis.FBE_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
const bm = crearBackendMemoria({ semilla: semillaDemo, persistir: false });
const api = crearApi(bm);
await bm.auth.entrar('ruben@fbe.demo', 'demo');
check((await api.comunidad053()) === true, 'la demo tiene la 053');
const cum = await api.cumplesComunidad();
check(Array.isArray(cum), 'los cumpleaños del equipo (lista)');
const ints2 = await api.intencionesComunidad();
check(Array.isArray(ints2), 'quién entrena hoy (lista)');
const miIt = await api.decirIntencion({ fecha: hoyM, hora: '18:00', nota: 'Gym' });
check(miIt?.nota === 'Gym' && (await api.intencionesComunidad()).some((x) => x.soy_yo && x.hora === '18:00'), 'Rubén dice cuándo entrena hoy y se ve');
await api.decirIntencion(null);
check(!(await api.intencionesComunidad()).some((x) => x.soy_yo), 'y lo quita');
const gente = (await api.personasComunidad());
const carlos = Object.entries(gente).find(([, p]) => p.nombre.startsWith('Carlos'))?.[0];
let duelos = await api.duelosMios();
check(duelos.length === 1 && duelos[0].estado === 'pendiente' && !duelos[0].soy_retador && duelos[0].rival_nombre === 'Carlos V.', 'en la demo, Carlos ha retado a Rubén esta semana');
const dId = await api.proponerDuelo(carlos, true);
duelos = await api.duelosMios();
check(dId && duelos.length === 2 && duelos.find((d) => d.id === dId)?.soy_retador, 'Rubén le reta para la semana que viene');
await api.retirarDuelo(dId);
check((await api.duelosMios()).length === 1, 'y lo retira');
check((await api.companeroSemana()).elegidos[0]?.nombre === 'Rubén M.' && (await api.cumplesComunidad()).some((x) => x.nombre === 'Carlos V.'), 'la semana pasada le eligieron compañero de la semana; hoy es el cumple de Carlos');
await api.votarCompanero(carlos);
const cs2 = await api.companeroSemana();
check(cs2.mi_voto === carlos && Number(cs2.votos) >= 1, 'vota a Carlos como compañero de la semana');
const hu2 = await api.huellaComunidad();
check(hu2 && 'animos_dados' in hu2 && typeof hu2.semanas_animando === 'number', 'su huella en el equipo');
const aj2 = await api.ajustesSociales({ cumple: true, ausencia: true });
check(aj2.cumple_equipo === true && aj2.ver_ausencia === true, 'enciende el cumple y «que me manden ánimo»');
check(Array.isArray(await api.sinEntrenarComunidad()), 'quién necesita un ánimo (lista)');
const pl2 = await api.padrinosComunidad();
check(pl2 && Array.isArray(pl2.vigentes) && Array.isArray(pl2.sin_padrino) && typeof pl2.puedo === 'boolean', 'los padrinos (lista)');
await api.animarComunidad(carlos, '¡A por ello!');
const anim = await api.animosComunidad();
check(anim.mandados.has(carlos), 'ánimo con palabras en la demo');
const enc2 = await api.publicarEnComunidad({ encuesta: { pregunta: '¿Sábado?', opciones: ['Sí', 'No'], cierre: null } });
check(enc2?.tipo === 'encuesta', 'Rubén publica una encuesta en la demo');
const m0 = await api.muro({ limite: 5 });
const otra = m0.posts.find((p) => !p.mio && p.tipo !== 'momento');
const citaPost = await api.publicarEnComunidad({ texto: 'Esto', citaPostId: otra.id });
check(citaPost?.cita_post_id === otra.id && (await api.muro({ limite: 5 })).posts.find((p) => p.id === citaPost.id)?.cita?.autor?.nombre, 'y cita otra publicación (el muro la trae con su autor)');
const ev = await api.guardarEvento({ titulo: 'Pierna juntos', fecha: sumarDias(hoyM, 2), hora: '10:00', lugar: 'Gym', plazas: 4 });
check(ev?.creado_por && (await api.eventosComunidad()).some((e) => e.id === ev.id && e.miRespuesta === true && e.propuestaPor), 'propone una quedada y va');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
