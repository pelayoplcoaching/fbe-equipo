// La tanda «cierre» (migración 054): lo que el coach necesita de cada entreno, sin pedirlo dos veces. La lógica pura
// (logica/cierre.js) y la migración en un Postgres local (PGlite): cerrar solas las sesiones acabadas, las sesiones
// abiertas, la semana de un vistazo, los hábitos sugeridos y el aviso de los vídeos sin revisar.
// Uso: node test/cierre.test.mjs
import { duracionDesdeSeries, rpeMedioSeries, fraseRpe, textoCierreAuto, habitosSugeridos, HABITOS_SUGERIDOS, borradorRevision, mensajeParaAlerta,
  chipsResumenChat, lineasSemanaCheckin, respuestasSemanaPasada, videosQueEsperan, alertasCierre, textoParaGuardar } from '../web/src/logica/cierre.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('La lógica pura');
const hoy = '2026-11-09';
const hechas = { e1: { 1: { registrada_en: '2026-11-09T10:00:00Z', rpe: 7 }, 2: { registrada_en: '2026-11-09T10:20:00Z', rpe: 8 } }, e2: { 1: { registrada_en: '2026-11-09T10:50:00Z', rpe: 9 } } };
check(duracionDesdeSeries(hechas) === 55 && duracionDesdeSeries({ e1: { 1: hechas.e1[1] } }) === null && duracionDesdeSeries({}) === null, 'la duración, de la primera a la última serie (más 5); con una sola, nada');
check(rpeMedioSeries(hechas) === 8 && rpeMedioSeries({ e1: { 1: { rpe: null } } }) === null, 'el esfuerzo medio de las series');
check(typeof fraseRpe(6) === 'string' && fraseRpe(10) !== fraseRpe(5) && fraseRpe(null) === '', 'cada esfuerzo tiene su frase');
const cerrada = { id: 's1', nombre: 'Pierna A', completada: true, cerrada_sola_en: '2026-11-08T14:00:00Z', fecha_realizada: '2026-11-08', duracion_min: 62 };
const c1 = textoCierreAuto(cerrada, hoy);
check(c1 && c1.titulo.includes('Pierna A') && c1.fecha === '2026-11-08' && /esfuerzo/.test(c1.texto) && textoCierreAuto({ ...cerrada, rpe_sesion: 8 }, hoy).texto !== c1.texto, 'la sesión cerrada por la app: qué y cuándo; con el esfuerzo ya estimado, otra frase');
check(textoCierreAuto({ ...cerrada, cerrada_sola_en: '2026-11-01T14:00:00Z' }, hoy) === null && textoCierreAuto({ ...cerrada, cerrada_sola_en: null }, hoy) === null, 'de hace más de 3 días (o no cerrada sola), no se pide');
const sug = habitosSugeridos({ objetivos: ['perder_grasa'] }, [{ nombre: 'Pasos al día', activo: true }]);
check(sug.length <= 3 && !sug.some((h) => h.clave === 'pasos') && sug[0].clave === 'verdura', 'sugeridos según el objetivo (perder grasa → verdura) y sin los que ya tiene');
const sug2 = habitosSugeridos({ objetivos: ['ganar_musculo'], lesiones: [{ zona: 'Hombro', limita: 'Me limita algo' }] }, []);
check(sug2.some((h) => h.clave === 'proteina') && sug2.some((h) => h.clave === 'movilidad'), 'con músculo y una molestia: proteína y movilidad');
check(habitosSugeridos(null, []).length === 3 && HABITOS_SUGERIDOS.every((h) => ['numero', 'si_no'].includes(h.tipo)), 'sin cuestionario, tres de base; todos de un tipo que la base admite');
const f = { nombre: 'Ana López', sesiones: { completadas: 2, total: 3 }, checkin: false, molestia: 2, videos: 1, notaAnterior: 'subir sentadilla' };
const r = { sesiones: { hechas: 2, previstas: 3, rpe_sesion: 8.7, series: 40, toneladas: 4.2 }, peso: { kg: 70.5, fecha: '2026-11-08', cambio_4s: -0.8 }, checkin: null, videos_sin_revisar: 1, sesiones_abiertas: 0 };
const b = borradorRevision(f, r);
check(b.startsWith('Hola, Ana.') && /2 de 3/.test(b) && /8,7/.test(b) && /alto/.test(b) && /70,5 kg/.test(b) && /molestia/.test(b) && /check-in/.test(b) && /vídeo/.test(b) && /subir sentadilla/.test(b), 'el mensaje de repaso, con sus datos');
check(borradorRevision({ nombre: 'Bea', sesiones: { completadas: 3, total: 3 }, checkin: true }, null).includes('✅ Las 3 sesiones'), 'con todo hecho, la enhorabuena');
check(mensajeParaAlerta({ tipo: 'sin_checkin' }, 'Ana López').startsWith('Hola, Ana.') && mensajeParaAlerta({ tipo: 'programar' }) === null && mensajeParaAlerta({ tipo: 'otro' }).includes('¿Cómo va'), 'pedírselo: un mensaje por aviso (el de programar es del coach)');
const chips = chipsResumenChat(r, hoy);
check(chips.find((x) => x.k === 'sesiones')?.texto === '2/3 ses.' && chips.find((x) => x.k === 'rpe')?.texto === 'RPE 8,7' && chipsResumenChat({ ...r, sesiones: { ...r.sesiones, rpe_sesion: 9.2 } }, hoy).find((x) => x.k === 'rpe')?.nivel === 'aviso' && chips.find((x) => x.k === 'peso')?.texto === '70,5 kg (-0,8)' && chips.find((x) => x.k === 'checkin')?.nivel === 'aviso' && chips.find((x) => x.k === 'videos'), 'los chips del chat: sesiones, esfuerzo alto, peso, sin check-in, vídeo');
check(chipsResumenChat({ ...r, checkin: { semana: '2026-11-09' } }, hoy).find((x) => x.k === 'checkin')?.texto === 'Check-in ✓', 'con el check-in de la semana, el tic');
const lin = lineasSemanaCheckin(r);
check(lin[0] === '2 de 3 sesiones hechas' && lin.some((x) => x.startsWith('Esfuerzo medio')) && lin.some((x) => x.includes('toneladas')) && lin.some((x) => x.startsWith('Último peso')) && lineasSemanaCheckin(null).length === 0, 'la semana de un vistazo en el check-in');
const ant = { horas_sueno: '7-8', energia: 4, motivacion: 3, notas: 'viaje', peso: 70 };
const rp = respuestasSemanaPasada(ant);
check(rp.horas_sueno === '7-8' && rp.energia === 4 && !('notas' in rp) && !('peso' in rp) && respuestasSemanaPasada(null) === null, 'igual que la semana pasada: escalas y números, no la nota ni el peso');
const vids = [{ creado_en: '2026-11-05T10:00:00Z', revisado_en: null }, { creado_en: '2026-11-08T10:00:00Z', revisado_en: null }, { creado_en: '2026-11-01T10:00:00Z', revisado_en: '2026-11-02T10:00:00Z' }];
const ve = videosQueEsperan(vids, hoy);
check(ve && ve.n === 1 && ve.dias === 4 && ve.texto === 'Un vídeo espera desde hace 4 días' && videosQueEsperan([vids[1]], hoy) === null, 'los vídeos que llevan 3 días o más sin revisar');
const al = alertasCierre({ abiertas: [{ sesion_id: 's', nombre: 'Pierna A', ultima_serie: '2026-11-08T10:00:00Z' }], pesos: [{ fecha: '2026-10-20', kg: 70 }], salud: true }, hoy);
check(al.some((a) => a.tipo === 'sesion_abierta') && al.some((a) => a.tipo === 'sin_peso') && alertasCierre({ abiertas: [], pesos: [{ fecha: hoy, kg: 70 }] }, hoy).length === 0, 'alertas del panel: sesión abierta y peso sin apuntar');
check(textoParaGuardar([{ texto: 'B segundo', creado_en: '2026-11-09T11:00:00Z' }, { texto: '*A* primero', creado_en: '2026-11-09T10:00:00Z' }, { texto: 'borrado', creado_en: '2026-11-09T12:00:00Z', eliminado_en: 'x' }]) === 'A primero\nB segundo', 'guardar como…: los mensajes en orden, en texto plano, sin los borrados');

console.log('\nLa migración 054 (PGlite)');
const { PGlite } = await import('@electric-sql/pglite');
const { aplicarEsquema } = await import('./esquema.mjs');
const db = new PGlite();
await aplicarEsquema(db, { repetirMigraciones: true });
check(true, 'esquema y migraciones aplicados, también al repetirlas');
const claims = (uid, aal) => `select set_config('request.jwt.claim.sub', '${uid}', false); select set_config('request.jwt.claims', '${uid ? JSON.stringify({ sub: uid, aal }) : ''}', false);`;
const su = async () => db.exec(`reset role; ${claims('', '')}`);
const como = async (uid, aal = 'aal1') => db.exec(`reset role; ${claims(uid, aal)} set role authenticated;`);
const servicio = async () => db.exec(`reset role; ${claims('', '')} set role service_role;`);
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const falla = async (sql, params = []) => { try { await db.query(sql, params); return false; } catch { return true; } };
const usuario = async (email) => { await su(); return (await q('insert into auth.users (email) values ($1) returning id', [email]))[0].id; };
const coach = await usuario('coach@x.test');
await q(`update public.perfiles set rol = 'coach', nombre = 'Coach' where id = $1`, [coach]);
await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true)`, [coach]);
const ana = await usuario('a@x.test');
const atletaA = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Ana', $1, 'activo') returning id`, [ana]))[0].id;
await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true)`, [ana]);
const bea = await usuario('b@x.test');
const atletaB = (await q(`insert into public.atletas (nombre, perfil_id, estado) values ('Bea', $1, 'activo') returning id`, [bea]))[0].id;
await q(`insert into public.preferencias_notificaciones (usuario_id, email) values ($1, true)`, [bea]);

check((await q(`select column_name from information_schema.columns where table_name = 'sesiones' and column_name = 'cerrada_sola_en'`)).length === 1
  && (await q(`select column_name from information_schema.columns where table_name = 'bloques' and column_name = 'objetivo_logrado'`)).length === 1
  && (await q(`select column_name from information_schema.columns where table_name = 'habitos' and column_name = 'origen'`)).length === 1, 'las columnas nuevas: sesiones.cerrada_sola_en, bloques.objetivo_logrado, habitos.origen');

const hoyM = (await q(`select (now() at time zone 'Europe/Madrid')::date::text as d`))[0].d;
const lunesM = (await q(`select (($1::date) - (extract(isodow from $1::date)::integer - 1))::text as d`, [hoyM]))[0].d;
const ej = (await q(`insert into public.ejercicios (nombre, grupos_musculares) values ('Sentadilla', '{cuadriceps}') returning id`))[0].id;
// Una sesión por atleta con dos ejercicios de 2 series; Ana hizo todas sus series hace 4 horas; Bea dejó una a medias hace 5 horas
const sesion = async (atleta, nombre) => {
  const bl = (await q(`insert into public.bloques (atleta_id, nombre, estado, fecha_inicio, objetivo) values ($1, 'B', 'activo', $2, 'Sentadilla 100 kg') returning id`, [atleta, lunesM]))[0].id;
  const se = (await q(`insert into public.semanas (bloque_id, numero, fecha_inicio, programacion) values ($1, 1, $2, 'programada') returning id`, [bl, lunesM]))[0].id;
  const s = (await q(`insert into public.sesiones (semana_id, orden, nombre) values ($1, 1, $2) returning id`, [se, nombre]))[0].id;
  const e1 = (await q(`insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, series) values ($1, $2, 1, 2) returning id`, [s, ej]))[0].id;
  const e2 = (await q(`insert into public.sesion_ejercicios (sesion_id, ejercicio_id, orden, series) values ($1, $2, 2, 2) returning id`, [s, ej]))[0].id;
  return { bl, s, e1, e2 };
};
const sa = await sesion(atletaA, 'Pierna A');
const sb = await sesion(atletaB, 'Pierna B');
const serie = (se, n, rpe, hace) => q(`insert into public.series (sesion_ejercicio_id, numero, kg, reps, rpe, registrada_en) values ($1, $2, 80, 5, $3, now() - $4::interval)`, [se, n, rpe, hace]);
await serie(sa.e1, 1, 7, '4 hours 40 minutes'); await serie(sa.e1, 2, 8, '4 hours 30 minutes'); await serie(sa.e2, 1, 8, '4 hours 10 minutes'); await serie(sa.e2, 2, 9, '4 hours');
await serie(sb.e1, 1, 7, '5 hours'); await serie(sb.e1, 2, 7, '5 hours');

// 1. Las sesiones abiertas: el coach ve las dos; Ana solo la suya
await como(coach);
let abiertas = await q(`select * from public.sesiones_abiertas()`);
check(abiertas.length === 2 && abiertas.every((x) => x.series_pautadas === 4) && abiertas.find((x) => x.nombre === 'Pierna A')?.series_hechas === 4 && abiertas.find((x) => x.nombre === 'Pierna B')?.series_hechas === 2, 'el coach ve las dos sesiones con series y sin terminar (hechas y pautadas bien contadas)');
await como(ana);
abiertas = await q(`select * from public.sesiones_abiertas()`);
check(abiertas.length === 1 && abiertas[0].nombre === 'Pierna A', 'Ana solo ve la suya');
check((await q(`select * from public.sesiones_abiertas($1)`, [atletaB])).length === 0, 'y pidiendo la de Bea, nada');

// 2. Cerrar solas: la de Ana (todas las series, 3 h sin tocar) sí; la de Bea (a medias) no
await como(ana);
check(await falla(`select public.crear_recordatorios()`), 'crear_recordatorios solo lo llama el servidor');
await servicio();
await q(`select public.crear_recordatorios(now())`);
await su();
const sesA = (await q(`select completada, cerrada_sola_en, rpe_sesion, duracion_min, fecha_realizada::text from public.sesiones where id = $1`, [sa.s]))[0];
const sesB = (await q(`select completada, cerrada_sola_en from public.sesiones where id = $1`, [sb.s]))[0];
check(sesA.completada && sesA.cerrada_sola_en && Number(sesA.rpe_sesion) === 8 && sesA.duracion_min >= 45 && sesA.duracion_min <= 46 && sesA.fecha_realizada && !sesB.completada && !sesB.cerrada_sola_en, 'la de Ana se cierra sola (RPE medio 8, 40 min + 5, fecha de la última serie); la de Bea, a medias, sigue abierta');
const notaA = await q(`select titulo, url, clave from public.notificaciones where usuario_id = $1 and clave = $2`, [ana, `sesion_cerrada:${sa.s}`]);
check(notaA.length === 1 && notaA[0].titulo === 'Hemos cerrado Pierna A por ti' && notaA[0].url === '#hoy', 'y Ana recibe el aviso para decir cómo fue');
await servicio();
await q(`select public.crear_recordatorios(now())`);
await su();
check((await q(`select count(*)::int as n from public.notificaciones where usuario_id = $1 and clave = $2`, [ana, `sesion_cerrada:${sa.s}`]))[0].n === 1, 'repetirlo no la cierra ni avisa dos veces');

// 3. La semana de un vistazo
await q(`insert into public.pesos (atleta_id, fecha, kg) values ($1, $2, 72.5), ($1, $2::date - 30, 74)`, [atletaA, hoyM]);
await como(ana);
const res = (await q(`select public.atleta_resumen_semana($1) as r`, [atletaA]))[0].r;
check(res && res.lunes === lunesM && res.sesiones.hechas === 1 && res.sesiones.previstas === 1 && Number(res.sesiones.rpe_sesion) === 8 && res.sesiones.series === 4 && Number(res.sesiones.toneladas) === 1.6 && Number(res.peso.kg) === 72.5 && Number(res.peso.cambio_4s) === -1.5 && res.checkin === null && res.sesiones_abiertas === 0 && res.sin_leer === null, 'Ana: su semana (sesión cerrada, 4 series, 1,6 t, peso y su cambio en 4 semanas)');
check((await q(`select public.atleta_resumen_semana($1) as r`, [atletaB]))[0].r === null, 'la de Bea, para Ana, nada');
// (revisión de la 054) sin ficha, o el coach con la verificación en dos pasos sin hacer, tampoco (antes el NULL lo dejaba pasar)
const suelto = await usuario('suelto@x.test');
await como(suelto);
check((await q(`select public.atleta_resumen_semana($1) as r`, [atletaB]))[0].r === null && (await q(`select public.atleta_resumen_semana(null) as r`))[0].r === null, 'una cuenta sin ficha no ve la semana de nadie');
await su();
await q(`update public.perfiles set exige_2fa = true where id = $1`, [coach]);
await como(coach, 'aal1');
const sin2fa = (await q(`select public.atleta_resumen_semana($1) as r`, [atletaB]))[0].r;
await su();
await q(`update public.perfiles set exige_2fa = false where id = $1`, [coach]);
check(sin2fa === null, 'ni el coach con la verificación en dos pasos pendiente');
await como(ana);
check(!(await falla(`update public.sesiones set cerrada_sola_en = null where id = $1`, [sa.s])) && (await q(`select cerrada_sola_en from public.sesiones where id = $1`, [sa.s]))[0].cerrada_sola_en, 'el atleta no quita (ni pone) la marca de «cerrada sola»');
await como(coach);
const resB = (await q(`select public.atleta_resumen_semana($1) as r`, [atletaB]))[0].r;
check(resB && resB.sesiones.hechas === 0 && resB.sesiones_abiertas === 1 && resB.peso === null && typeof resB.sin_leer === 'number', 'el coach ve la de Bea: nada hecho, una sesión abierta, sin peso, y los mensajes sin leer');

// 4. Un hábito sugerido
await como(ana);
const hid = (await q(`select public.habito_sugerido_activar('Pasos al día', 'numero', 8000, 'pasos', 'al_menos', 7, 'pasos') as r`))[0].r;
await su();
const hab = (await q(`select nombre, origen, activo, objetivo, dias_semana from public.habitos where id = $1`, [hid]))[0];
check(hab.nombre === 'Pasos al día' && hab.origen === 'sugerido' && hab.activo && Number(hab.objetivo) === 8000 && hab.dias_semana === 7, 'Ana activa un hábito sugerido: queda con origen «sugerido»');
await como(ana);
check(await falla(`select public.habito_sugerido_activar('Pasos al día', 'numero', 8000, 'pasos')`) && await falla(`select public.habito_sugerido_activar('Otro', 'texto')`), 'ni repetido ni de un tipo que no existe');
for (const n of ['Dos', 'Tres', 'Cuatro', 'Cinco']) await q(`select public.habito_sugerido_activar($1, 'si_no')`, [n]);
check(await falla(`select public.habito_sugerido_activar('Seis', 'si_no')`), 'como mucho cinco activos');
await como(coach);
check(await falla(`select public.habito_sugerido_activar('X', 'si_no')`), 'el coach no activa sugeridos (los pone él, con origen coach)');

// 5. El aviso de los vídeos sin revisar (3 días o más), a las 10–12 de la mañana
await su();
await q(`insert into public.archivos (atleta_id, tipo, ruta, creado_en) values ($1::uuid, 'video_tecnica', $2 || '/v1.mp4', now() - interval '5 days'), ($1::uuid, 'video_tecnica', $2 || '/v2.mp4', now() - interval '1 day')`, [atletaA, atletaA]);
const manana = (await q(`select (($1::date + 1)::timestamp + time '11:00') at time zone 'Europe/Madrid' as t`, [hoyM]))[0].t;
await servicio();
await q(`select public.crear_recordatorios($1)`, [manana]);
await su();
const avisoV = await q(`select titulo, url from public.notificaciones where usuario_id = $1 and clave like 'videos_pendientes:%'`, [coach]);
check(avisoV.length === 1 && avisoV[0].titulo === 'Un vídeo espera tu revisión' && avisoV[0].url === '#revisar', 'al coach: un vídeo (el de 5 días) espera; el de ayer aún no cuenta');
const tarde = (await q(`select (($1::date + 1)::timestamp + time '17:00') at time zone 'Europe/Madrid' as t`, [hoyM]))[0].t;
await servicio();
await q(`select public.crear_recordatorios($1)`, [tarde]);
await su();
check((await q(`select count(*)::int as n from public.notificaciones where usuario_id = $1 and clave like 'videos_pendientes:%'`, [coach]))[0].n === 1, 'por la tarde no se repite (una vez al día)');

// 6. objetivo_logrado lo pone el coach; el atleta lo lee
await como(coach);
await q(`update public.bloques set estado = 'finalizado', objetivo_logrado = true where id = $1`, [sa.bl]);
await como(ana);
check((await q(`select objetivo_logrado from public.bloques where id = $1`, [sa.bl]))[0].objetivo_logrado === true, 'el objetivo logrado del bloque, puesto por el coach, lo ve el atleta');
check(await falla(`update public.bloques set objetivo_logrado = false where id = $1`, [sa.bl]) || (await q(`select objetivo_logrado from public.bloques where id = $1`, [sa.bl]))[0].objetivo_logrado === true, 'pero no lo cambia');

await db.close();
console.log(`\n${ok} comprobaciones bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
