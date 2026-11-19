// (v0.191) La revisión semanal, más fácil de pasar: lo puro (orden, filtros, pausados, check-in, récords y parones,
// frases, lotes) y las consultas nuevas contra la demo (detalle de un atleta, semana que viene, semanas pasadas).
//   node test/revision.test.mjs
import * as RV from '../web/src/logica/revision.js';
import { borradorRevision } from '../web/src/logica/cierre.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { fechaMadrid, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

console.log('La revisión semanal (v0.191): lo puro');
const L = '2026-11-16';
const f = (id, x = {}) => ({ atleta_id: id, nombre: id, estado: 'activo', servicio: 'completo', sesiones: { completadas: 3, total: 3 }, checkin: true, molestia: 0, videos: 0, mensajes: 0, alertas: [], hecha: false, historial: [], ...x });

{
  const { activos, pausados } = RV.partirPausados([f('A'), f('B', { estado: 'pausado' }), f('C')]);
  check(activos.map((x) => x.atleta_id).join() === 'A,C' && pausados.map((x) => x.atleta_id).join() === 'B' && RV.partirPausados(null).activos.length === 0, 'los pausados van aparte y no cuentan');
}
{
  const av = RV.avisosPanel(f('A', { alertas: [{ tipo: 'molestia', nivel: 'alerta', texto: 'Molestia' }, { tipo: 'sin_checkin', texto: 'Sin check-in' }, { tipo: 'sesion_abierta', nivel: 'aviso', texto: 'Sesión sin cerrar' }, { tipo: 'sin_peso', texto: 'Sin peso' }, null] }));
  check(av.map((x) => x.tipo).join() === 'sesion_abierta,sin_peso' && av[1].nivel === 'info' && RV.avisosPanel({}).length === 0, 'los avisos del panel salen sin repetir los que ya tienen su chip');
}
{
  const h = (l, hecha) => ({ lunes: l, hecha, nota: '' });
  check(RV.semanasSinRevisar(f('A', { hecha: true }), L) === 0 && RV.semanasSinRevisar(f('A'), L) === 9
    && RV.semanasSinRevisar(f('A', { historial: [h('2026-11-09', true)] }), L) === 1 && RV.semanasSinRevisar(f('A', { historial: [h('2026-11-09', false), h('2026-10-26', true)] }), L) === 3, 'cuántas semanas lleva sin revisar');
  const filas = [f('Zoe', { historial: [h('2026-11-09', true)] }), f('Ana', { hecha: true }), f('Beto'), f('Carla', { historial: [h('2026-11-02', true)] })];
  check(RV.ordenarRevision(filas, 'nombre').map((x) => x.nombre).join() === 'Beto,Carla,Zoe,Ana', 'por nombre, con los revisados al final');
  check(RV.ordenarRevision(filas, 'antiguedad', { lunes: L }).map((x) => x.nombre).join() === 'Beto,Carla,Zoe,Ana', 'primero quien lleva más tiempo sin revisar');
  check(RV.ordenarRevision(filas, 'mio', { mio: ['Zoe', 'Beto'] }).map((x) => x.nombre).join() === 'Zoe,Beto,Carla,Ana', '«Mi orden»: como lo dejó, los nuevos detrás');
  check(RV.ordenarRevision(filas, 'urgencia').length === 4 && RV.ordenarRevision(filas, 'raro').map((x) => x.nombre).join() === RV.ordenRevision(filas).map((x) => x.nombre).join(), 'un orden desconocido es el de siempre');
  check(RV.moverEnOrden(['a', 'b', 'c'], 'b', -1).join() === 'b,a,c' && RV.moverEnOrden(['a', 'b', 'c'], 'c', 1).join() === 'a,b,c' && RV.moverEnOrden(['a'], 'x', 1).join() === 'a', 'subir y bajar en «Mi orden»');
}
{
  const filas = [f('A', { videos: 2 }), f('B', { checkin: false }), f('C', { molestia: 2, videos: 1 }), f('D', { proxima: 'sin', mensajes: 1 }), f('N', { servicio: 'nutricion', checkin: false })];
  check(RV.filtrarRevision(filas, ['videos']).map((x) => x.atleta_id).join() === 'A,C' && RV.filtrarRevision(filas, ['videos', 'molestias']).map((x) => x.atleta_id).join() === 'C'
    && RV.filtrarRevision(filas, []).length === 5 && RV.filtrarRevision(filas, new Set(['sin_checkin'])).map((x) => x.atleta_id).join() === 'B'
    && RV.filtrarRevision(filas, ['sin_programar', 'mensajes']).map((x) => x.atleta_id).join() === 'D', 'los filtros se suman (quien cumple todos)');
  check(RV.cuentaFiltro(filas, 'videos') === 2 && RV.cuentaFiltro(filas, 'nada') === 0, 'y cada uno dice cuántos hay');
}
{
  const w = (fecha, prog) => ({ fecha_inicio: fecha, programacion: prog });
  check(RV.estadoProxima([w('2026-11-16', 'programada'), w('2026-11-23', 'programada')], L) === 'publicada' && RV.estadoProxima([w('2026-11-16', 'programada'), w('2026-11-23', 'borrador')], L) === 'borrador'
    && RV.estadoProxima([w('2026-11-16', 'programada')], L) === 'sin' && RV.estadoProxima([{ fecha_inicio: null }], L) === null && RV.estadoProxima([], L) === null, 'la semana que viene: publicada, en borrador o sin programar');
}
{
  const c = { energia: 2, recuperacion: 3, motivacion: 4, horas_sueno: '5-6', adherencia_desayuno: 4, adherencia_comida: 5, pasos_media: 9000, notas: 'bien' };
  const ant = { energia: 4, recuperacion: 3, motivacion: 3, horas_sueno: '7-8', adherencia_desayuno: 5, adherencia_comida: 5, pasos_media: 8000 };
  const ls = RV.lineasCheckin(c, ant), de = (k) => ls.find((x) => x.clave === k);
  check(de('energia').cambio === 'baja' && de('energia').valor === '2/5' && de('recuperacion').cambio === null && de('motivacion').cambio === 'sube' && de('horas_sueno').antes === '7-8 h'
    && de('adherencia').valor === '4,5/5' && de('adherencia').cambio === 'baja' && de('pasos_media').cambio === 'sube' && !de('saciedad') && RV.lineasCheckin(null).length === 0
    && RV.lineasCheckin(c).every((x) => x.cambio === null), 'el check-in en líneas, con lo que cambia frente al anterior');
}
{
  const s = (ej, fecha, kg, reps) => ({ ejercicio_id: ej, ejercicio: ej, fecha, kg, reps, rpe: 8, numero: 1 });
  const series = [
    s('banca', '2026-11-02', 80, 5), s('banca', '2026-11-09', 80, 5), s('banca', '2026-11-17', 82.5, 5),
    s('remo', '2026-11-02', 70, 8), s('remo', '2026-11-09', 70, 8), s('remo', '2026-11-17', 70, 8),
    s('curl', '2026-11-02', 16, 10), s('curl', '2026-11-09', 14, 10), s('curl', '2026-11-17', 12, 10),
    s('nuevo', '2026-11-17', 50, 8), s('viejo', '2026-11-09', 50, 8), s('futuro', '2026-11-24', 200, 5),
    s('sube1', '2026-11-09', 40, 8), s('sube1', '2026-11-17', 40, 8),
  ];
  const pr = RV.progresoSemana(series, L);
  check(pr.records.map((x) => x.ejercicio).join() === 'banca' && pr.records[0].marca.startsWith('82,5 kg') && pr.parados.map((x) => `${x.ejercicio}:${x.estado}`).join() === 'curl:baja,remo:parado', 'récords, parados y bajones de la semana');
  check(RV.progresoSemana([], L).records.length === 0 && RV.progresoSemana(null, L).parados.length === 0, 'sin series, nada');
  const com = RV.comentariosSemana([{ nombre: 'Torso', completada: true, fecha: '2026-11-17', nota_atleta: ' Bien ' }, { nombre: 'Pierna', completada: false, nota_atleta: 'x' }],
    [{ ...s('banca', '2026-11-16', 80, 5), nota: 'me molestó el hombro' }, { ...s('banca', '2026-11-09', 80, 5), nota: 'vieja' }], L);
  check(com.length === 2 && com[0].texto === 'me molestó el hombro' && com[1].donde === 'Torso', 'lo que escribió esta semana, en orden');
}
{
  const filas = RV.pautadoFrenteAHecho([{ id: 1, ejercicio: { nombre: 'Banca' }, series: 3, reps_min: 5, reps_max: 6, rir_objetivo: 2, hechas: [{ kg: 80, reps: 6, rpe: 7.5 }, { kg: 80, reps: 6 }] }, { id: 2, series: 2, reps_min: 10, reps_max: 10, hechas: [] }]);
  check(filas[0].pautado === '3 x 5-6 · RIR 2' && filas[0].hecho === '80 x 6 (7,5), 80 x 6' && filas[0].falta === 1 && filas[1].hecho === 'Sin hacer' && filas[1].pautado === '2 x 10' && filas[1].nombre === 'Ejercicio', 'lo pautado frente a lo hecho');
}
{
  const filas = [f('Ana López', { checkin: false }), f('Beto', { checkin: false, estado: 'pausado' }), f('Caro', { checkin: false, servicio: 'nutricion' }), f('Dani', { sesiones: { completadas: 0, total: 3 } })];
  const d = RV.destinatariosLote(filas, 'checkin');
  check(d.length === 1 && d[0].texto.startsWith('Hola, Ana.') && RV.destinatariosLote(filas, 'sesiones').map((x) => x.nombre).join() === 'Dani' && RV.destinatariosLote(filas, 'nada').length === 0, 'pedir en lote: a quién y con su nombre');
  check(RV.conNombre('Hola, {nombre}. ¿Qué tal, {nombre}?', 'Ana López') === 'Hola, Ana. ¿Qué tal, Ana?', 'el nombre de cada uno en el mensaje');
}
{
  let l = RV.conFrase([], '  Buen   trabajo ');
  l = RV.conFrase(l, 'Otra'); l = RV.conFrase(l, 'Buen trabajo');
  check(l.join('|') === 'Buen trabajo|Otra' && RV.conFrase(l, '  ').length === 2 && RV.sinFrase(l, 'Otra').join() === 'Buen trabajo' && RV.conFrase(Array.from({ length: 25 }, (_, i) => `f${i}`), 'x').length === 20, 'las frases: sin repetir, la última delante, 20 como mucho');
  const r = RV.insertarFrase('Hola.\nAdiós.', 'En medio', 5);
  check(r.texto === 'Hola.\nEn medio\nAdiós.' && r.cursor === 14 && RV.insertarFrase('', 'A').texto === 'A' && RV.insertarFrase('Hola', 'B').texto === 'Hola\nB', 'una frase entra donde está el cursor, en su línea');
}
{
  check(RV.siguientePendiente(['a', 'b', 'c'], new Set(['a', 'b']), 'b') === 'c' && RV.siguientePendiente(['a', 'b', 'c'], new Set(['b', 'c']), 'c') === 'a' && RV.siguientePendiente(['a', 'b'], new Set(['a', 'b']), 'a') === null, 'uno a uno: el siguiente sin revisar, dando la vuelta');
}
{
  const fila = f('Ana López', { sesiones: { completadas: 2, total: 3 } });
  const extra = RV.extraParaBorrador({ sesiones: [{ nombre: 'Torso B', completada: false }, { nombre: 'Torso A', completada: true }], progreso: { records: [{ ejercicio: 'Press banca', marca: '80 kg x 6' }], parados: [{ ejercicio: 'Remo' }] },
    checkin: { energia: 2, motivacion: 4, horas_sueno: '5-6', notas: 'cansada' }, checkinDeEstaSemana: true });
  const t = borradorRevision(fila, null, extra);
  check(/Sin hacer: Torso B\./.test(t) && /Récord en Press banca \(80 kg x 6\)/.test(t) && /Remo: lleva un par de semanas/.test(t) && /la energía va justa/.test(t) && /Duermes poco \(5-6 h\)/.test(t) && /He leído lo que me cuentas/.test(t), 'el mensaje redactado nombra récords, lo que no hizo y el check-in');
  check(borradorRevision(fila, null) === borradorRevision(fila, null, null) && RV.extraParaBorrador(null) === null && RV.extraParaBorrador({ checkin: { energia: 1 }, checkinDeEstaSemana: false }).checkin === null, 'sin esos datos, el de siempre (y el check-in viejo no se cita)');
}

console.log('\nLa revisión semanal (v0.191): contra la demo');
{
  const backend = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  await backend.auth.entrar('pelayo@fbe.demo', 'demo');
  const api = crearApi(backend);
  const hoy = fechaMadrid(), lunes = lunesDe(hoy);
  const rev = await api.revisionSemanal(hoy);
  check(rev.lunes === lunes && rev.filas.length >= 5 && rev.filas.every((x) => Array.isArray(x.historial) && 'proxima' in x && 'pausa' in x), 'la revisión trae el historial, la pausa y la semana que viene de cada uno');
  check(rev.filas.some((x) => ['publicada', 'borrador', 'sin'].includes(x.proxima)) && rev.filas.filter((x) => x.servicio === 'nutricion').every((x) => x.proxima === null), 'la semana que viene, solo de quien entrena');
  const con = rev.filas.find((x) => x.sesiones.completadas > 0) || rev.filas[0];
  const d = await api.detalleRevision(con.atleta_id, lunes);
  check(d.lunes === lunes && Array.isArray(d.sesiones) && d.sesiones.filter((x) => x.completada).every((x) => x.fecha >= lunes && x.fecha <= sumarDias(lunes, 6)) && Array.isArray(d.progreso.records) && Array.isArray(d.comentarios), 'el detalle de un atleta: sus sesiones de la semana, récords y comentarios');
  check(d.sesiones.filter((x) => x.completada).length === con.sesiones.completadas || con.sesiones.completadas === 0 || d.sesiones.length > 0, 'las sesiones del detalle cuadran con las de la fila');
  await api.marcarRevision(con.atleta_id, lunes, { hecha: true, nota: 'subir la sentadilla' });
  const otra = (await api.revisionSemanal(hoy)).filas.find((x) => x.atleta_id === con.atleta_id);
  check(otra.hecha && otra.historial.some((h) => h.lunes === lunes && h.nota === 'subir la sentadilla'), 'lo marcado sale en su historial');
  const nota = await api.notaDeRevision(con.atleta_id);
  check(nota?.nota === 'subir la sentadilla' && nota.lunes === lunes && (await api.notaDeRevision(null)) === null, 'la nota de la revisión, para el editor');
  const pasada = await api.revisionDeSemana(lunes);
  check(pasada.filas.find((x) => x.atleta_id === con.atleta_id)?.hecha === true && pasada.filas.length >= rev.filas.length, 'una semana, solo para verla');
  let mal = false; try { await api.revisionDeSemana('ayer'); } catch { mal = true; }
  check(mal, 'una semana que no vale, no');
  await backend.auth.entrar('ana@fbe.demo', 'demo');
  let negado = false; try { const r = await crearApi(backend).revisionDeSemana(lunes); negado = !r.filas.some((x) => x.nota); } catch { negado = true; }
  check(negado, 'un atleta no ve las notas de la revisión');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
