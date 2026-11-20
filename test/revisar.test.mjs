// (v0.195) La pestaña «Revisar» del coach: lo puro (urgencia, agrupar por día, apartar hasta mañana, buscar, lo nuevo,
// varias a la vez, récords de una sesión, contexto) y las consultas nuevas contra la demo.
//   node test/revisar.test.mjs
import * as R from '../web/src/logica/revisar.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

console.log('Revisar (v0.195): lo puro');
const ahora = new Date('2026-11-20T10:00:00');
const hoy = '2026-11-20';
const A = { id: 'a', nombre: 'Ana López' }, B = { id: 'b', nombre: 'Rubén Gómez' };
const ses = (id, x = {}, atleta = A) => ({ tipo: 'sesiones', clave: `s-${id}`, atleta, s: { id, fecha_realizada: hoy, rpeMax: 8, ...x } });
const ck = (id, x = {}, atleta = A) => ({ tipo: 'checkins', clave: `c-${id}`, atleta, c: { id, semana_inicio: '2026-11-16', creado_en: '2026-11-19T20:00:00', molestias: [], ...x } });
const msg = (id, texto, creado = '2026-11-20T09:00:00', atleta = A) => ({ tipo: 'mensajes', clave: `m-${id}`, atleta, h: { clave: id, ultimo: { id, texto, creado_en: creado }, n: 1, ids: [id] } });
const vid = (id, x = {}, atleta = A) => ({ tipo: 'videos', clave: `v-${id}`, atleta, a: { id, creado_en: '2026-11-20T08:00:00', ...x } });

{
  check(R.urgenciaItem(ck('1', { molestias: [{ intensidad: 3 }] }), ahora).nivel === 'alta', 'una molestia fuerte en el check-in es urgente');
  check(R.urgenciaItem(ck('1', { molestias: [{ intensidad: 2 }] }), ahora).nivel === 'media', 'una moderada, a mirar pronto');
  check(R.urgenciaItem(ck('1', { energia: 2 }), ahora).motivos.includes('Energía baja'), 'energía 2/5: energía baja');
  check(R.urgenciaItem(ses('1', { rpeMax: 10 }), ahora).motivos.includes('Alguna serie a RPE 10'), 'una serie a RPE 10 sale');
  check(R.urgenciaItem(ses('1'), ahora).nivel === null, 'una sesión normal de hoy no es urgente');
  check(R.urgenciaItem(msg('1', '¿Subo el peso?'), ahora).motivos.includes('Te pregunta algo'), 'un mensaje con pregunta');
  check(R.urgenciaItem(msg('1', 'Hecho'), ahora).nivel === null, 'un mensaje sin pregunta, no');
  check(R.urgenciaItem(vid('1', { autoevaluacion: { molestia: true } }), ahora).nivel === 'alta', 'molestia en el vídeo: urgente');
  check(R.urgenciaItem(ses('1', { fecha_realizada: '2026-11-15' }), ahora).motivos.includes('Lleva más de 3 días esperando'), 'lo que lleva más de 3 días, también');
  const g = R.urgenciaGrupo([ses('1'), ck('2', { molestias: [{ intensidad: 3 }] }), ses('3', { rpeMax: 10 })], ahora);
  check(g.nivel === 'alta' && g.motivos.length === 2, 'el atleta toma el nivel de lo más urgente suyo, con sus motivos sin repetir');
  const grupos = [{ id: 'a', atleta: A, items: [ses('1'), msg('2', 'ok')] }, { id: 'b', atleta: B, items: [ses('3'), ck('4', { molestias: [{ intensidad: 3 }] }, B)] }];
  const o = R.ordenarUrgente(grupos, ahora);
  check(o[0].id === 'b' && o[0].items[0].clave === 'c-4', 'lo urgente primero: el atleta con la molestia arriba, y dentro, la molestia');
}

{
  const items = [ses('1'), ses('2', { fecha_realizada: '2026-11-19' }), ck('3'), ses('4', { fecha_realizada: '2026-11-17' }), ses('5', { fecha_realizada: '2026-11-01' }), msg('6', 'hola', '2026-11-20T13:30:00')];
  const g = R.agruparPorDia(items, hoy);
  check(g.map((x) => x.dia).join(',') === 'hoy,ayer,semana,antes', 'por día: Hoy, Ayer, Esta semana y Antes (solo los que tienen algo)');
  check(g[0].items[0].clave === 'm-6', 'dentro de cada día, lo más nuevo arriba');
  check(g[1].n === 2 && g[1].tipos.checkins === 1, 'ayer: la sesión y el check-in (que se mandó ayer)');
  check(R.tramoDia(null, hoy) === 'antes', 'sin fecha, a «Antes»');
}

{
  let m = R.posponer({}, 's-1', hoy);
  check(m['s-1'] === '2026-11-21', 'apartar hasta mañana');
  check(Object.keys(R.pospuestosVigentes(m, hoy)).length === 1, 'hoy sigue apartada');
  check(Object.keys(R.pospuestosVigentes(m, '2026-11-21')).length === 0, 'mañana vuelve a salir');
  m = R.posponer({ viejo: '2026-11-01' }, 's-2', hoy);
  check(!('viejo' in m) && m['s-2'], 'lo que ya volvió no se queda guardado para siempre');
  check(!('s-2' in R.sinPosponer(m, 's-2')), 'y se puede deshacer');
}

{
  check(R.coincideNombre('Rubén Gómez', 'ruben'), 'buscar sin tildes ni mayúsculas');
  check(R.coincideNombre('Rubén Gómez', 'gom rub'), 'por trozos, en cualquier orden');
  check(!R.coincideNombre('Ana López', 'ruben'), 'quien no es, no sale');
  check(R.coincideNombre('Ana', '  '), 'sin buscar, salen todos');
}

{
  const items = [ses('1'), ses('2'), ck('3')];
  check(R.separarNuevas(items, null).nuevas.length === 0, 'al entrar, nada es nuevo');
  const r = R.separarNuevas(items, new Set(['s-1', 'c-3']));
  check(r.nuevas.length === 1 && r.nuevas[0].clave === 's-2' && r.vistas.length === 2, 'lo que llega después, aparte');
}

{
  const g = { tipo: 'videos', clave: 'sv-9', atleta: A, g: { videos: [{ id: 'v1' }, { id: 'v2' }] } };
  const rv = R.revisablesDe([ses('1'), ck('2'), msg('3', 'hola'), g, { tipo: 'tareas', clave: 't-4', t: { id: '4' } }, { tipo: 'recetas', clave: 'r-5', r: { id: '5' } }]);
  check(rv.length === 4, 'se pueden revisar de golpe sesiones, check-ins, vídeos y tareas (los mensajes y las recetas, no)');
  check(rv.find((x) => x.clave === 'sv-9').marcas.length === 2, 'una sesión con dos vídeos, sus dos vídeos');
  const d = { sesiones: [{ id: '1' }, { id: '9' }], checkins: [{ id: '2' }], archivos: [{ id: 'v1' }, { id: 'v2' }], total: 5 };
  const sin = R.bandejaSin(d, rv.flatMap((x) => x.marcas));
  check(sin.sesiones.length === 1 && sin.checkins.length === 0 && sin.archivos.length === 0, 'la bandeja, sin lo revisado');
  check(R.bandejaSin(sin, rv.flatMap((x) => x.marcas)) === sin, 'aplicarlo dos veces da lo mismo');
}

{
  const fila = (sesion, fecha, ej, kg, reps, rpe = 8, reg = `${fecha}T10:00:00`) => ({ sesion_id: sesion, fecha, ejercicio_id: ej, ejercicio: ej === 'sq' ? 'Sentadilla' : 'Press banca', kg, reps, rpe, registrada_en: reg });
  const series = [
    fila('s1', '2026-11-03', 'sq', 100, 5), fila('s1', '2026-11-03', 'pb', 80, 5),
    fila('s2', '2026-11-10', 'sq', 102.5, 5), fila('s2', '2026-11-10', 'pb', 80, 6),
    fila('s3', '2026-11-17', 'sq', 105, 5), fila('s3', '2026-11-17', 'pb', 75, 5),
  ];
  const m = R.marcasSesion(series, { id: 's3', fecha_realizada: '2026-11-17' });
  check(m.records.length === 1 && m.records[0].ejercicio === 'Sentadilla' && m.records[0].marca === '105 kg x 5', 'récord en sentadilla (su mejor 1RM estimado)');
  check(m.bajas.length === 1 && m.bajas[0].ejercicio === 'Press banca' && m.bajas[0].antes === '80 kg x 6', 'el press baja frente a la última vez');
  check(R.marcasSesion(series, { id: 's1', fecha_realizada: '2026-11-03' }).records.length === 0, 'la primera vez no hay récord (nada con que comparar)');
  check(R.marcasSesion([], { id: 'x' }).records.length === 0, 'sin series, nada');
}

{
  check(R.textoContexto({ semana: 3, total: 6, bloque: 'Fuerza', ultima: '2026-11-18T10:00:00' }, ahora) === 'Semana 3 de 6 de «Fuerza», le contestaste hace 2 días', 'el contexto: semana del bloque y tu última respuesta');
  check(R.textoContexto({ semana: null, total: null, bloque: null, ultima: '2026-11-20T08:00:00' }, ahora) === 'Le has contestado hoy', 'hoy');
  check(R.textoContexto({ semana: 1, total: 4, bloque: null, ultima: null }, ahora) === 'Semana 1 de 4, aún no le has contestado nada', 'nunca');
  const bloques = [{ id: 'b1', nombre: 'Bloque 1', creado_en: '2026-10-01' }, { id: 'b2', nombre: 'Bloque 2', creado_en: '2026-11-01' }];
  const semanas = [{ id: 'w1', bloque_id: 'b1', numero: 1, fecha_inicio: '2026-10-05' }, { id: 'w2', bloque_id: 'b2', numero: 1, fecha_inicio: '2026-11-09' }, { id: 'w3', bloque_id: 'b2', numero: 2, fecha_inicio: '2026-11-16' }, { id: 'w4', bloque_id: 'b2', numero: 3, fecha_inicio: null }];
  const s = R.semanaDelBloque(bloques, semanas, hoy);
  check(s.semana === 2 && s.total === 3 && s.bloque === 'Bloque 2' && s.bloqueId === 'b2', 'en qué semana va: la de este lunes, de su bloque');
  check(R.semanaDelBloque([], [], hoy) === null, 'sin bloques, nada');
  check(R.textoCuentaDia(3) === 'Hoy has revisado 3 cosas.' && R.textoCuentaDia(0) === '', 'la cuenta del día');
}

console.log('\nRevisar (v0.195): contra la demo');
{
  const backend = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  await backend.auth.entrar('pelayo@fbe.demo', 'demo');
  const api = crearApi(backend);
  const bj = await api.bandeja();
  check(bj.checkins.every((c) => 'anterior' in c), 'la bandeja trae el check-in anterior de cada uno (o null)');
  const ids = [...new Set([...bj.sesiones, ...bj.checkins].map((x) => x.atleta.id))];
  const ctx = await api.contextoRevisar(ids);
  check(ids.every((id) => id in ctx), 'el contexto de cada atleta con algo por revisar');
  check(Object.values(ctx).some((c) => c.semana != null && c.bloqueId), 'alguno con su semana del bloque');
  const marcas = await api.marcasSesiones(bj.sesiones);
  check(bj.sesiones.every((s) => marcas[s.id] && Array.isArray(marcas[s.id].records)), 'récords y bajadas de cada sesión por revisar');
  const s = bj.sesiones[0];
  if (s) {
    await api.marcarRevisado('sesion', s.id);
    const hoyRev = await api.revisadosHoy(hoyISO());
    check(hoyRev.some((x) => x.tipo === 'sesion' && x.id === s.id && x.atleta?.id === s.atleta.id), 'lo revisado hoy sale, con su atleta');
    await api.marcarRevisado('sesion', s.id, false);
    check(!(await api.revisadosHoy(hoyISO())).some((x) => x.id === s.id), 'al volver a pendiente, ya no');
    check((await api.revisadosHoy(sumarDias(hoyISO(), 1))).length === 0, 'mañana, la lista empieza vacía');
  } else check(false, 'la demo tiene sesiones por revisar');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
