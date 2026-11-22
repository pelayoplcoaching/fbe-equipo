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

console.log('\nLa revisión semanal, segunda tanda (v0.192): lo puro');
{
  const p = RV.pasosRevision(f('A', { videos: 1, mensajes: 0, escritos: 2, proxima: 'borrador' }));
  check(p.map((x) => `${x.clave}:${x.hecho ? 1 : 0}`).join() === 'videos:0,mensajes:1,repaso:1,programar:0' && RV.pasosRevision(f('N', { servicio: 'nutricion' })).map((x) => x.clave).join() === 'mensajes,repaso', 'tus pasos con cada atleta se tachan solos');
  check(RV.filtrarRevision([f('A', { estadoRevision: 'esperando' }), f('B'), f('C', { estadoRevision: 'programar', hecha: true })], ['a_medias']).map((x) => x.atleta_id).join() === 'A' && RV.TEXTO_ESTADO.esperando === 'Esperando su respuesta', '«A medias» tiene su filtro (los ya revisados no cuentan)');
}
{
  const s = (fecha, kg, reps, rpe) => ({ fecha, kg, reps, rpe });
  const c = RV.compararSemanas([s('2026-11-17', 100, 5, 8), s('2026-11-18', 100, 5, 9), s('2026-11-10', 100, 5, 8), s('2026-11-03', 500, 5, 8)], L), de = (k) => c.find((x) => x.clave === k);
  check(de('series').valor === '2' && de('series').antes === '1' && de('series').cambio === 'sube' && de('toneladas').valor === '1' && de('toneladas').antes === '0,5' && de('rpe').valor === '8,5' && de('rpe').cambio === 'sube'
    && RV.compararSemanas([], L).length === 0 && RV.compararSemanas([s('2026-11-17', 100, 5, 8)], L)[0].cambio === null, 'esta semana frente a la anterior: series, toneladas y esfuerzo');
}
{
  const s = (pauta, reps, rpe, ej = 'Banca') => ({ sesion_ejercicio_id: pauta, fecha: '2026-11-17', reps, rpe, ejercicio: ej });
  const q = RV.quedoCorto([s('p1', 6, 8), s('p1', 4, 10), s('p2', 10, 8, 'Remo'), s('p2', 10, 8, 'Remo'), s('p3', 8, 8, 'Curl'), { ...s('p1', 2, 10), fecha: '2026-11-10' }, s('otra', 1, 10)],
    [{ id: 'p1', reps_min: 5, series: 3 }, { id: 'p2', reps_min: 8, series: 2 }, { id: 'p3', reps_min: 8, series: 3 }], L);
  check(q.map((x) => x.ejercicio).join() === 'Banca,Curl' && q[0].cortas === 1 && q[0].tope === 1 && q[0].faltan === 1 && RV.textoCorto(q[0]) === '1 por debajo del rango, 1 a RPE 10, falta 1 serie' && RV.textoCorto(q[1]) === 'faltan 2 series', 'dónde se quedó corto: bajo el rango, a tope o con series sin hacer');
}
{
  check(RV.puntoDelBloque({ bloque: { numero: 3, foco: 'volumen' }, semana: { numero: 4, total: 6 } }) === 'Bloque 3 · semana 4 de 6 · foco: volumen' && RV.puntoDelBloque({}) === '' && RV.puntoDelBloque({ bloque: { nombre: 'Base' } }) === 'Base', 'en qué punto del bloque está');
  const ses = [{ completada: true, cardio_hecho: { modalidad: 'carrera', km: 8, semaforo: 'verde' } }, { completada: true, cardio_hecho: { modalidad: 'carrera', km: 12.5, semaforo: 'ambar' } }, { completada: true, cardio_hecho: { modalidad: 'bici', km: 30 } }, { completada: false }];
  const cr = RV.carreraDeLaSemana(ses, { km_min: 25, km_max: 30, etiqueta: 'Base 2' });
  check(cr.km === 20.5 && cr.salidas === 2 && cr.previsto === '25-30 km' && cr.semaforo === 'ambar' && cr.estado === 'bien' && RV.carreraDeLaSemana(ses, { km_min: 30, km_max: 30 }).estado === 'de_menos'
    && RV.carreraDeLaSemana(ses, { km_max: 15 }).estado === 'de_mas' && RV.carreraDeLaSemana([], null) === null && RV.carreraDeLaSemana(ses, null).previsto === null, 'la carrera: lo corrido frente a lo previsto y su semáforo');
}
{
  const fila = f('Ana López', { sesiones: { completadas: 3, total: 3 } });
  const base = borradorRevision(fila, null);
  const red = RV.conTono(base, 'redonda', fila.nombre), flo = RV.conTono(base, 'floja', fila.nombre);
  check(red.startsWith('Hola, Ana. Semana redonda') && red.endsWith('💪') && red.split('\n').length === base.split('\n').length && flo.includes('más floja') && RV.conTono(base, null, fila.nombre) === base && RV.conTono(base, 'auto', fila.nombre) === base, 'el tono cambia cómo abre y cómo cierra el mensaje; lo de en medio, sus datos');
  const sin = RV.conTono(borradorRevision(f('Ana', { sesiones: { completadas: 0, total: 3 } }), null), 'sin', 'Ana');
  check(!/no hemos podido entrenar/.test(sin) && /no ha salido el entreno/.test(sin) && RV.tonoDe(f('A', { sesiones: { completadas: 0, total: 3 } })) === 'sin' && RV.tonoDe(f('A', { sesiones: { completadas: 1, total: 3 } })) === 'floja' && RV.tonoDe(fila) === 'redonda', 'sin entrenar no lo dice dos veces; y el tono automático sale de sus sesiones');
  check(RV.proximoLunesALas(new Date(2026, 10, 19, 20, 0)) === '2026-11-23T08:00' && RV.proximoLunesALas(new Date(2026, 10, 23, 7, 0)) === '2026-11-30T08:00' && RV.proximoLunesALas(new Date(2026, 10, 22, 23, 0), 9) === '2026-11-23T09:00', 'programar el envío: por defecto, el lunes que viene a las 8');
}
{
  const r = RV.resumenRevision([f('Ana L', { hecha: true, escritos: 1, proxima: 'publicada' }), f('Beto', { proxima: 'sin', checkin: false }), f('Caro', { estadoRevision: 'esperando', proxima: 'borrador' })]);
  check(r.total === 3 && r.revisados === 1 && r.conRepaso === 1 && r.porProgramar.join() === 'Beto,Caro' && r.esperando.join() === 'Caro' && r.sinCheckin.join() === 'Beto', 'el resumen de la revisión');
  const filas = [f('Zoe', { videos: 2, sesiones: { completadas: 1, total: 4 } }), f('Ana', { videos: 0, proxima: 'sin' }), f('Beto', { videos: 5, proxima: 'publicada' })];
  check(RV.ordenarTabla(filas, 'nombre').map((x) => x.nombre).join() === 'Ana,Beto,Zoe' && RV.ordenarTabla(filas, 'videos', -1).map((x) => x.nombre).join() === 'Beto,Zoe,Ana' && RV.ordenarTabla(filas, 'sesiones').map((x) => x.nombre)[0] === 'Zoe'
    && RV.ordenarTabla(filas, 'proxima').map((x) => x.nombre)[0] === 'Ana' && RV.ordenarTabla(filas, 'rara').length === 3, 'la tabla se ordena por cualquier columna');
}
{
  const id = '11111111-2222-3333-4444-555555555555';
  check(RV.ajustesDeRevision(null, { frases: ['a'], orden: [id], modo: 'mio' }).frases.join() === 'a' && RV.ajustesDeRevision({ frases: ['b'], orden: [], modo: null, vista: 'tabla' }, { frases: ['a'], modo: 'nombre' }).frases.join() === 'b'
    && RV.ajustesDeRevision({ frases: ['b'], orden: [], modo: null, vista: null }, { modo: 'nombre' }).modo === 'nombre' && RV.ajustesDeRevision(null, null).modo === 'urgencia', 'los ajustes: manda la base; si allí no hay nada, lo de este aparato');
  check(RV.ajustesDeRevision({ frases: ['b'], orden: [], modo: 'urgencia', vista: 'lista' }, { frases: ['a'], orden: [id], modo: 'mio', vista: 'tabla' }, true).orden.join() === id
    && RV.ajustesDeRevision({ frases: ['b'], orden: [], modo: 'urgencia', vista: 'lista' }, { frases: ['a'], orden: [id], modo: 'mio' }, true).modo === 'mio', 'pero un cambio de este aparato que no llegó a subirse manda sobre la base');
  const g = RV.ajustesParaGuardar({ frases: [' a  b ', 'a b', '', 'x'.repeat(400)], orden: [id, 'malo', 7], modo: 'raro', vista: 'tabla' });
  check(g.frases.length === 2 && g.frases[0] === 'a b' && g.frases[1].length === 300 && g.orden.join() === id && g.modo === null && g.vista === 'tabla', 'y solo se sube lo que cabe en la base');
  check(RV.lineasCheckin({ adherencia_desayuno: 5, adherencia_cena: 2 }, { adherencia_cena: 4 }, { porComida: true }).filter((x) => /^Adherencia: /.test(x.etiqueta)).map((x) => `${x.etiqueta}:${x.valor}:${x.cambio}`).join() === 'Adherencia: desayuno:5/5:null,Adherencia: cena:2/5:baja'
    && !RV.lineasCheckin({ adherencia_desayuno: 5 }).some((x) => /desayuno/.test(x.etiqueta)), 'quien es solo de nutrición ve la adherencia comida a comida');
}

console.log('\nLa revisión semanal, tercera tanda (v0.193): lo puro');
{
  check(RV.citaDe.record({ ejercicio: 'Press banca', marca: '80 kg x 6' }) === 'Récord en Press banca (80 kg x 6).' && /dos semanas bajando/.test(RV.citaDe.parado({ ejercicio: 'Curl', estado: 'baja', marca: '12 kg x 10' }))
    && RV.citaDe.corto({ ejercicio: 'Remo', cortas: 2, tope: 0, faltan: 0 }) === 'Remo: 2 por debajo del rango.' && RV.citaDe.sesion({ nombre: 'Torso A', completada: true, rpe_sesion: 8, duracion_min: 65 }) === 'Torso A, esfuerzo 8, 65 min:'
    && /sin hacer/.test(RV.citaDe.sesion({ nombre: 'Torso B', completada: false })) && RV.citaDe.checkin([{ etiqueta: 'Energía', valor: '2/5', cambio: 'baja' }, { etiqueta: 'Sueño', valor: '6-7 h', cambio: null }]) === 'Del check-in: energía 2/5.', 'un dato de su semana se cita en una frase');
  check(RV.pestanasDe(f('A', { videos: 2 })).map(([k]) => k).join() === 'semana,chat,videos,programar' && RV.pestanasDe(f('A')).map(([k]) => k).join() === 'semana,chat,programar' && RV.pestanasDe(f('N', { servicio: 'nutricion' })).map(([k]) => k).join() === 'semana,chat', 'las pestañas de uno a uno: solo las que le tocan');
  check(RV.quedoCorto([{ sesion_ejercicio_id: 'p', ejercicio_id: 'e1', fecha: '2026-11-17', reps: 3, rpe: 8, ejercicio: 'Banca' }], [{ id: 'p', reps_min: 5, series: 1 }], L)[0].ejercicio_id === 'e1', 'lo corto dice de qué ejercicio es (para ajustarlo)');
}

console.log('\nLa revisión semanal, el progreso (v0.194): lo puro');
{
  const PR = await import('../web/src/logica/progreso-revision.js');
  const dias = (desde, n, f) => Array.from({ length: n }, (_, i) => { const d = new Date(`${desde}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return f(d.toISOString().slice(0, 10), i); });
  // Peso: baja 0,5 kg por semana desde 85 durante 8 semanas, pesándose a diario
  const pesos = dias('2026-09-28', 56, (fecha, i) => ({ fecha, kg: Math.round((85 - (i / 7) * 0.5) * 10) / 10 }));
  const plan = { fase: 'perder', ritmo_pct: -0.6 };
  const p = PR.progresoDePeso({ pesos, plan, objetivo: { peso_objetivo: 78, peso_inicio: 85 }, lunes: L, hoy: '2026-11-22' });
  check(p.esta.lunes === L && p.antes.lunes === '2026-11-09' && p.dif < 0 && Math.abs(p.dif + 0.5) < 0.1 && p.diasEsta === 7 && p.semanas.length === 8, 'peso: la media de la semana frente a la anterior y los días que se ha pesado');
  check(p.ritmo && Math.abs(p.ritmo.kgSemana + 0.5) < 0.05 && p.estado === 'verde' && p.meta === 78 && p.falta < 0 && p.prevision?.semanas > 0, 'peso: su ritmo frente al del plan (verde), lo que le queda y en cuántas semanas');
  check(PR.estadoRitmo(-0.6, -0.6) === 'verde' && PR.estadoRitmo(-0.3, -0.6) === 'ambar' && PR.estadoRitmo(0.5, -0.6) === 'rojo' && PR.estadoRitmo(-0.6, -0.6, true) === 'rojo'
    && PR.estadoRitmo(0.1, 0) === 'verde' && PR.estadoRitmo(0.4, 0) === 'ambar' && PR.estadoRitmo(0.7, 0) === 'rojo' && PR.estadoRitmo(null, -0.5) === 'gris' && PR.estadoRitmo(-0.5, null) === 'gris', 'los umbrales del peso');
  const sube = dias('2026-10-26', 28, (fecha, i) => ({ fecha, kg: 80 + i * 0.05 }));
  check(PR.progresoDePeso({ pesos: sube, plan, lunes: L, hoy: '2026-11-22' }).contrario === true && PR.progresoDePeso({ pesos: sube, plan, lunes: L, hoy: '2026-11-22' }).estado === 'rojo', 'si las dos últimas semanas van al revés de lo buscado, rojo');
  check(PR.progresoDePeso({ pesos: [], lunes: L, hoy: '2026-11-22' }).sinPesos && PR.progresoDePeso({ pesos: [], lunes: L, hoy: '2026-11-22' }).estado === 'gris', 'sin pesos, gris');
  check(/^Baja 0,5 kg\/semana; su plan busca bajar 0,4/.test(PR.textoRitmo(p)), `el ritmo, en palabras («${PR.textoRitmo(p)}»)`);
  // Medidas
  const med = [{ fecha: '2026-09-01', cintura_cm: 90, cadera_cm: 100 }, { fecha: '2026-10-20', cintura_cm: 88, cadera_cm: 99 }, { fecha: '2026-11-17', cintura_cm: 86.5, cadera_cm: 99.2, brazo_cm: 35 }];
  const m = PR.progresoDeMedidas({ medidas: med, fase: 'perder', bloqueInicio: '2026-10-01', hoy: '2026-11-20', peso: { dif: -0.1 } });
  const ci = m.cambios.find((c) => c.clave === 'cintura_cm');
  check(ci.dif === -1.5 && ci.difBloque === -1.5 && m.cambios.find((c) => c.clave === 'brazo_cm').dif === null && m.primeraBloque === '2026-10-20' && m.estado === 'verde' && m.diasDesde === 3 && !m.pedir, 'medidas: frente a la anterior y frente a la primera del bloque');
  check(/^Peso estable y cintura −1,5 cm: buena señal de recomposición/.test(m.juntos), `peso y cintura juntos («${m.juntos}»)`);
  const vieja = PR.progresoDeMedidas({ medidas: med, fase: 'perder', hoy: '2026-12-30' });
  check(vieja.pedir && vieja.estado === 'ambar' && PR.progresoDeMedidas({ medidas: [], hoy: '2026-11-20' }).nunca && PR.progresoDeMedidas({ medidas: [{ fecha: '2026-11-01', cintura_cm: 80 }, { fecha: '2026-11-15', cintura_cm: 81.2 }], fase: 'perder', hoy: '2026-11-20' }).estado === 'rojo'
    && PR.progresoDeMedidas({ medidas: [{ fecha: '2026-11-01', cintura_cm: 80 }, { fecha: '2026-11-15', cintura_cm: 81.2 }], fase: 'ganar', hoy: '2026-11-20' }).estado === 'ambar', 'medidas: viejas (ámbar y pedirlas), sin medidas, y la cintura según su fase');
  // Comida
  const ck = (l, x) => ({ semana_inicio: l, ...x });
  const checkins = [ck('2026-11-09', { adherencia_desayuno: 5, adherencia_comida: 5, adherencia_merienda: 4, adherencia_cena: 4, horas_sueno: '7-8', energia: 4, saciedad: 3, fc_reposo: 55 }),
    ck(L, { adherencia_desayuno: 5, adherencia_comida: 4, adherencia_merienda: 2, adherencia_cena: 4, horas_sueno: '5-6', energia: 2, recuperacion: 2, saciedad: 2, calorias_media: 2100, fc_reposo: 62 }),
    ck('2026-10-26', { fc_reposo: 55 }), ck('2026-11-02', { fc_reposo: 56 }), ck('2026-10-19', { fc_reposo: 57 })];
  const menu = [{ fecha: '2026-11-16', hecho: true }, { fecha: '2026-11-16', hecho: true }, { fecha: '2026-11-17', hecho: false }, { fecha: '2026-11-10', hecho: true }];
  const c = PR.progresoDeComida({ checkins, menu, registros: [{ fecha: '2026-11-17', kcal: 2000, completo: true }, { fecha: '2026-11-18', kcal: 2200, completo: true }], plan: { kcal: 2300 }, lunes: L });
  check(c.adherencia.esta === 3.8 && c.adherencia.antes === 4.5 && c.adherencia.peor.etiqueta === 'Merienda' && c.estado === 'ambar' && c.deEstaSemana, 'comida: la adherencia frente a la anterior y la comida que más falla');
  check(c.menu.total === 3 && c.menu.hechas === 2 && c.menu.pct === 67 && c.menu.pctAntes === 100 && c.menu.dias[0].hechas === 2 && c.menu.dias.length === 7, 'comida: el menú hecho, día a día');
  check(c.kcal.media === 2100 && c.kcal.fuente === 'registro' && c.kcal.dif === -200 && c.saciedad === 2 && c.saciedadAntes === 3 && c.serie.length === 6, 'comida: calorías frente a su plan, saciedad y 6 semanas');
  // Descanso
  const salud = dias('2026-11-09', 14, (fecha, i) => ({ fecha, sueno_min: i < 7 ? 450 : (i % 2 ? 330 : 400), pasos: i < 7 ? 8000 : 10000 }));
  const dS = PR.progresoDeDescanso({ checkins, salud, pasosObjetivo: 9000, lunes: L });
  check(dS.sueno.fuente === 'salud' && dS.sueno.esta < 6.5 && dS.sueno.antes === 7.5 && dS.sueno.cortas === 4 && dS.pasos.esta === 10000 && dS.pasos.antes === 8000 && dS.pasos.objetivo === 9000, 'descanso: sueño del iPhone (con noches cortas) y pasos, frente a la anterior');
  const dC = PR.progresoDeDescanso({ checkins, salud: null, lunes: L });
  check(dC.sueno.fuente === 'checkin' && dC.sueno.esta === 5.5 && dC.estado === 'rojo' && dC.fc.dif >= 5 && dC.avisos.some((x) => /pulso/.test(x)) && dC.avisos.some((x) => /recuperación/.test(x)) && dC.series.energia.length === 6, 'descanso: sin iPhone, el check-in; pulso por encima de su media y recuperación baja, avisados');
  // Todo junto
  const todo = PR.progresoAtleta({ pesos, plan, checkins, medidas: med, menu, salud: null }, { lunes: L, hoy: '2026-11-22', nombre: 'Ana López' });
  check(todo.semaforo.peso === 'verde' && todo.semaforo.comida === 'ambar' && todo.semaforo.descanso === 'rojo' && todo.rojos === 1 && todo.peorEstado === 'rojo', 'el semáforo de cuatro puntos');
  check(/^Baja al ritmo previsto, .*le cuesta la merienda, duerme poco/.test(todo.frase), `la frase («${todo.frase}»)`);
  check(todo.paraAtleta.some((x) => /^Peso medio de la semana: /.test(x)) && PR.progresoAtleta({}, { lunes: L }).frase === 'Sin pesos.' && PR.progresoAtleta({ nutricion: false }, { lunes: L }).comida.fuera, 'las líneas para el mensaje; sin datos, poco; sin nutrición, sin el bloque de comida');
  const filas = [f('A', { progreso: { rojos: 0, ambar: 1, desvio: 0 } }), f('B', { progreso: { rojos: 2, ambar: 0, desvio: 0 } }), f('C', { progreso: { rojos: 0, ambar: 1, desvio: 0.5 } }), f('D', { hecha: true, progreso: { rojos: 4 } })];
  check(RV.ordenarRevision(filas, 'progreso').map((x) => x.atleta_id).join() === 'B,C,A,D' && RV.filtrarRevision(filas, ['progreso_rojo']).map((x) => x.atleta_id).join() === 'B,D' && RV.resumenRevision(filas).enRojo.join() === 'B,D', 'ordenar y filtrar por progreso, y el resumen');
  check(RV.ajustesParaGuardar({ modo: 'progreso' }).modo === null && RV.ajustesParaGuardar({ modo: 'mio' }).modo === 'mio', '«Lo que peor va primero» se queda en el aparato (la 082 no lo conoce)');
  check(RV.puntoDelBloque({ bloque: { numero: 1, foco: 'adaptacion' } }) === 'Bloque 1 · foco: adaptación', 'el foco, con su tilde');
  const t = borradorRevision(f('Ana', { sesiones: { completadas: 3, total: 3 } }), { peso: { kg: 80 } }, RV.extraParaBorrador(null, todo));
  check(/Peso medio de la semana/.test(t) && !/^Peso: 80/m.test(t), 'el mensaje redactado usa el peso medio (y no repite el de siempre)');
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
  // (v0.192) en la demo, como la 082
  check((await api.revisionSemanal(hoy)).con082 === true && await api.revisionAjustes() === null, 'la demo se comporta como una base con la 082');
  await api.guardarRevisionAjustes({ frases: ['Muy bien'], orden: [con.atleta_id], modo: 'mio', vista: 'tabla' });
  await api.guardarRevisionAjustes({ frases: ['Muy bien', 'A por ello'], orden: [con.atleta_id], modo: 'nombre', vista: 'lista' });
  const aj = await api.revisionAjustes();
  check(aj.frases.length === 2 && aj.modo === 'nombre' && (await backend.select('revision_ajustes', {})).length === 1, 'los ajustes del coach se guardan en una sola fila');
  await api.marcarRevision(con.atleta_id, lunes, { hecha: false, estado: 'programar' });
  check((await api.revisionSemanal(hoy)).filas.find((x) => x.atleta_id === con.atleta_id).estadoRevision === 'programar', 'y un atleta se queda «a medias»');
  let malo = false; try { await backend.upsert('revisiones_semanales', [{ atleta_id: con.atleta_id, lunes, estado: 'otro' }], 'atleta_id,lunes'); } catch { malo = true; }
  check(malo, 'un estado que no existe, tampoco en la demo');
  const d2 = await api.detalleRevision(con.atleta_id, lunes);
  check(Array.isArray(d2.comparacion) && Array.isArray(d2.cortos) && Array.isArray(d2.mensajes) && Array.isArray(d2.videos) && typeof d2.fotos === 'number', 'el detalle trae lo de la segunda tanda');
  // (v0.194)
  const pe = await api.progresoEquipo(rev.filas, lunes);
  check(Object.keys(pe).length === rev.filas.length && Object.values(pe).every((x) => x && x.semaforo && typeof x.frase === 'string'), 'el progreso de todo el equipo, en una consulta');
  check(Object.values(pe).some((x) => x.peso.esta) && Object.values(pe).some((x) => x.semaforo.peso !== 'gris'), 'con pesos de la demo, alguno tiene su peso comparado');
  check(Object.keys(await api.progresoEquipo([], lunes)).length === 0, 'sin atletas, nada');
  // (v0.193)
  const um = await api.ultimosMensajes(con.atleta_id, 4);
  check(Array.isArray(um) && um.length <= 4 && um.every((m) => 'autor' in m && 'sinLeer' in m && 'audio' in m) && (um.length < 2 || um[0].creado_en <= um[um.length - 1].creado_en), 'lo último que os habéis dicho, de más antiguo a más nuevo');
  check((await api.videoAnterior(null)) === null && (await api.videoAnterior({ id: 'x', atleta_id: con.atleta_id })) === null, 'sin ejercicio no hay vídeo anterior que comparar');
  const bj0 = await api.bandeja();
  const suyos0 = [...bj0.sesiones, ...bj0.checkins, ...bj0.archivos].filter((x) => (x.atleta?.id || x.atleta_id) === con.atleta_id).length;
  const marcados = await api.revisarLoDe(con.atleta_id);
  const bj1 = await api.bandeja();
  const suyos1 = [...bj1.sesiones, ...bj1.checkins, ...bj1.archivos].filter((x) => (x.atleta?.id || x.atleta_id) === con.atleta_id).length;
  await api.deshacerRevisados(marcados);
  const bj2 = await api.bandeja();
  const suyos2 = [...bj2.sesiones, ...bj2.checkins, ...bj2.archivos].filter((x) => (x.atleta?.id || x.atleta_id) === con.atleta_id).length;
  check(marcados.length === suyos0 && suyos1 === 0 && suyos2 === suyos0, `dar por revisado lo suyo de «Revisar» (${suyos0}) y deshacerlo`);
  const d3 = await api.detalleRevision(con.atleta_id, lunes);
  check(Array.isArray(d3.audios) && 'checkinId' in d3 && d3.atleta?.id === con.atleta_id, 'el detalle trae sus audios sin escuchar, el check-in para comentarlo y sus datos para el editor');
  await backend.auth.entrar('ana@fbe.demo', 'demo');
  let sinAjustes = false; try { sinAjustes = !(await backend.select('revision_ajustes', {})).length; } catch { sinAjustes = true; }
  let noEscribe = false; try { await backend.upsert('revision_ajustes', [{ frases: ['x'] }], 'usuario_id'); } catch { noEscribe = true; }
  check(sinAjustes && noEscribe, 'un atleta no ve ni toca los ajustes del coach');
  let negado = false; try { const r = await crearApi(backend).revisionDeSemana(lunes); negado = !r.filas.some((x) => x.nota); } catch { negado = true; }
  check(negado, 'un atleta no ve las notas de la revisión');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
