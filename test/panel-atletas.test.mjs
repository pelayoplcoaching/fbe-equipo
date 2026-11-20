// (v0.198) La lista de Atletas a tu gusto: lo puro (columnas, orden, filtros, contadores, grupos, buscar, etiquetas,
// nota, vistas y el anterior/siguiente desde la ficha) y lo guardado contra la demo (como la migración 085).
//   node test/panel-atletas.test.mjs
import * as P from '../web/src/logica/panel-atletas.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

console.log('Atletas a tu gusto (v0.198): lo puro');
const hoy = '2026-11-20';   // viernes; su lunes, el 16
const r = (id, x = {}) => ({ atleta_id: id, nombre: id, estado: 'activo', servicio: 'completo', alertas: [], prioridad: 3, sesiones: { completadas: 0, total: 3 }, maxMolestia: 0, ...x });
const ana = r('Ana López', { checkin: { semana: '2026-11-09', energia: 4 }, peso: { kg: 61.7 }, ultimaSerie: '2026-11-18', nivel: 'intermedio', bloque: { id: 'b1', foco: 'volumen' }, semana: { numero: 4, total: 6, foco: 'volumen' }, cumplimiento: { series: { pct: 99, hechas: 157, pautadas: 159 } } });
const carlos = r('Carlos Vera', { alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: '15 días' }], prioridad: 1, ultimaSerie: '2026-11-05', maxMolestia: 2, nivel: 'novato', bloque: { id: 'b2', foco: 'adaptacion' }, cobro: { estado: 'retrasado' }, carrera: true, cumplimiento: { series: { pct: 75 } } });
const lucia = r('Lucía Ferrer', { servicio: 'nutricion', checkin: { semana: '2026-11-16' }, diasNutricion: 6 });
const marta = r('Marta Gil', { estado: 'invitado', alertas: [{ tipo: 'invitado', nivel: 'info', texto: 'Aún no' }], prioridad: 2 });
const iv = r('Iván Prieto', { estado: 'pausado', bloque: { id: 'b3' } });
const baja = r('Zoe Baja', { estado: 'baja' });
const todos = [ana, carlos, lucia, marta, iv, baja];
const extra = { sinLeer: { 'Carlos Vera': 2 }, proxima: { 'Ana López': 'borrador', 'Carlos Vera': 'publicada' }, panel: { 'Lucía Ferrer': { fijado: true, etiquetas: ['Preboda'], nota: 'Boda el 12/12' }, 'Ana López': { fijado: false, etiquetas: ['Media maratón', 'preboda'], nota: null } } };

// Columnas
check(P.COLUMNAS_DEFECTO.join() === 'avisos,pagos,semana,sesiones,peso,sueno,motivacion,molestias,ultimo', 'las columnas de siempre, por defecto');
check(P.limpiarColumnas(['peso', 'raro', 'peso', 'nota']).join() === 'peso,nota' && P.limpiarColumnas([]).length === 9, 'columnas: sin repetir ni inventadas; vacías, las de siempre');
check(P.moverColumna(['a', 'b', 'c'], 'b', -1).join() === 'b,a,c' && P.moverColumna(['a', 'b'], 'a', -1).join() === 'a,b', 'mover una columna un puesto (y no salirse)');

// Lo que no viene en el resumen
check(P.checkinAlDia(ana, hoy) && !P.checkinAlDia(carlos, hoy) && P.checkinAlDia(lucia, hoy), 'check-in al día: el de la semana pasada o el de esta');
check(P.proximaDe(ana, extra) === 'borrador' && P.proximaDe(carlos, extra) === 'publicada' && P.proximaDe(lucia, extra) === null && P.proximaDe(iv, extra) === null
  && P.proximaDe(r('Sin', {}), extra) === 'sin_bloque', 'la semana que viene: borrador, publicada, sin bloque; nada para solo nutrición o en pausa');
check(P.porProgramar(ana, extra) && !P.porProgramar(carlos, extra), 'por programar: lo que no está publicado');
check(P.diasSinEntrenar(ana, hoy) === 2 && P.diasSinEntrenar(carlos, hoy) === 15 && P.diasSinEntrenar(lucia, hoy) === null, 'días sin entrenar');

// Filtros, contadores y buscar
check(P.cumpleEstado(baja, 'todos') === false && P.cumpleEstado(carlos, 'atencion') && !P.cumpleEstado(ana, 'atencion') && P.cumpleEstado(marta, 'invitados') && P.cumpleEstado(iv, 'inactivos', ['Iván Prieto']), 'el filtro de siempre (todos sin los de baja, atención, sin activar, sin actividad)');
const base = todos.filter((x) => P.cumpleEstado(x, 'todos'));
const c = P.contar(base, extra, hoy);
check(c.sinCheckin === 1 && c.porProgramar === 1 && c.molestias === 1 && c.sinLeer === 1 && c.pago === 1, `los contadores (${JSON.stringify(c)})`);
const f = P.limpiarFiltros({ servicio: 'completo', nivel: 'raro', etiqueta: ' Preboda ', marcas: ['molestias', 'inventada', 'molestias'] });
check(f.servicio === 'completo' && f.nivel === null && f.etiqueta === 'Preboda' && f.marcas.join() === 'molestias', 'filtros limpios (sin valores inventados)');
check(base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, etiqueta: 'PREBODA' }, extra, hoy)).map((x) => x.nombre).join() === 'Ana López,Lucía Ferrer', 'filtrar por etiqueta (sin mirar mayúsculas)');
check(base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, nivel: 'sin' }, extra, hoy)).length === 3 && base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, marcas: ['carrera', 'pago'] }, extra, hoy)).length === 1, 'sin nivel; y las marcas se suman (carrera y pago pendiente)');
check(base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, marcas: ['pausa'] }, extra, hoy))[0]?.nombre === 'Iván Prieto' && base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, marcas: ['fijados'] }, extra, hoy))[0]?.nombre === 'Lucía Ferrer', 'en pausa y fijados');
check(P.coincide(ana, 'ana lopez', extra) && P.coincide(lucia, 'boda', extra) && P.coincide(ana, 'maraton', extra) && !P.coincide(carlos, 'maraton', extra) && P.coincide(carlos, '', extra), 'buscar en el nombre, las etiquetas y la nota, sin tildes');
check(P.textoFiltros({ servicio: 'nutricion', nivel: 'sin', etiqueta: 'Preboda', marcas: ['sinLeer'] }) === 'Solo nutrición, Sin nivel, «Preboda», Chat sin leer', 'el resumen de los filtros, en palabras');

// Orden
const nombres = (xs) => xs.map((x) => x.nombre.split(' ')[0]).join(',');
check(nombres(P.ordenar(base, { col: 'urgencia' }, extra, hoy)) === 'Lucía,Carlos,Marta,Ana,Iván', `lo urgente primero, con los fijados arriba (${nombres(P.ordenar(base, { col: 'urgencia' }, extra, hoy))})`);
check(nombres(P.ordenar(base, { col: 'nombre', dir: 'asc' }, {}, hoy)) === 'Ana,Carlos,Iván,Lucía,Marta' && nombres(P.ordenar(base, { col: 'nombre', dir: 'desc' }, {}, hoy)) === 'Marta,Lucía,Iván,Carlos,Ana', 'por nombre, en los dos sentidos');
check(nombres(P.ordenar(base, { col: 'peso', dir: 'desc' }, {}, hoy)).startsWith('Ana,') && nombres(P.ordenar(base, { col: 'sinEntrenar', dir: 'desc' }, {}, hoy)).startsWith('Carlos,Ana'), 'por una columna; lo que no tiene dato, al final');
check(nombres(P.ordenar(base, { col: 'mensajes', dir: 'desc' }, extra, hoy)).startsWith('Lucía,Carlos'), 'por mensajes sin leer (el fijado sigue arriba)');
check(P.dirInicial('ultimo') === 'desc' && P.dirInicial('nombre') === 'asc' && P.limpiarOrden({ col: 'raro' }).col === 'urgencia', 'cada columna empieza en su sentido útil; una inventada, lo urgente');

// Grupos
const gE = P.agrupar(P.ordenar(todos, { col: 'nombre' }, {}, hoy), 'estado', extra);
check(gE.map((g) => g.titulo).join() === 'Activos,En pausa,Sin activar,De baja', 'agrupar por estado, en su orden');
const gT = P.agrupar(base, 'etiqueta', extra);
check(gT.map((g) => `${g.titulo}:${g.items.length}`).join() === 'Media maratón:1,Preboda:2,Sin etiqueta:3', `por etiqueta: quien tiene varias sale en cada una (${gT.map((g) => `${g.titulo}:${g.items.length}`).join()})`);
check(P.agrupar(base, 'nivel', extra).at(-1).titulo === 'Sin nivel' && P.agrupar(base, '', extra).length === 1, 'por nivel (sin nivel, al final); sin agrupar, un solo grupo');

// Etiquetas y nota
check(P.limpiarEtiquetas([' Preboda ', 'preboda', '', 'x'.repeat(40), 'A\nB', ...'abcdefghij'.split('')]).length === 8 && P.limpiarEtiquetas(['A\nB'])[0] === 'A B' && P.limpiarEtiqueta('x'.repeat(40)).length === 24, 'etiquetas: hasta 8, de 24 letras, sin repetir ni saltos de línea');
check(P.limpiarNota('  Revisar\n rodilla ') === 'Revisar rodilla' && P.limpiarNota('   ') === null && [...P.limpiarNota('ñ'.repeat(300))].length === 200, 'la nota: una línea de hasta 200');
check(P.limpiarPanelAtleta({ fijado: false, etiquetas: [], nota: ' ' }) === null && P.limpiarPanelAtleta({ fijado: true }).fijado === true, 'sin nada que guardar, se borra');
check(P.etiquetasUsadas(extra.panel).join() === 'Preboda,Media maratón', 'las etiquetas que usas, de más a menos usada');
const ce = P.conEtiqueta(extra.panel, ['Ana López', 'Carlos Vera'], 'Revisión domingo');
check(ce['Ana López'].etiquetas.join() === 'Media maratón,preboda,Revisión domingo' && ce['Carlos Vera'].etiquetas.join() === 'Revisión domingo', 'poner una etiqueta a varios');
check(P.conEtiqueta(extra.panel, ['Lucía Ferrer'], 'PREBODA', false)['Lucía Ferrer'].etiquetas.length === 0 && P.conEtiqueta(extra.panel, ['Ana López'], 'Media maratón', false)['Ana López'].etiquetas.join() === 'preboda', 'y quitársela');
check(P.colorEtiqueta('Preboda', { preboda: 'verde' }) === 'verde' && P.COLORES_ETIQUETA.includes(P.colorEtiqueta('Otra')) && P.colorEtiqueta('Otra') === P.colorEtiqueta('otra'), 'el color de cada etiqueta: el tuyo o uno fijo');

// Ajustes y vistas
const aj0 = P.limpiarAjustesPanel({ columnas: ['peso'], orden: { col: 'peso', dir: 'desc' }, agrupar: 'raro', compacta: 1, vistas: [{ nombre: '' }, { nombre: 'Lunes de programar', estado: 'todos', filtros: { marcas: ['porProgramar'] } }], colores: { Preboda: 'verde', otra: 'fucsia' } });
check(aj0.columnas.join() === 'peso' && aj0.orden.col === 'peso' && aj0.agrupar === '' && aj0.compacta === true && aj0.vistas.length === 1 && aj0.colores.preboda === 'verde' && !aj0.colores.otra, 'ajustes limpios (vistas sin nombre fuera, colores que existen)');
let aj = P.guardarVista(aj0, 'Revisiones del domingo', { estado: 'atencion', filtros: { etiqueta: 'Revisión domingo' }, orden: { col: 'nombre', dir: 'asc' }, agrupar: 'nivel', compacta: false });
check(aj.vistas.length === 2 && aj.vistas[1].estado === 'atencion' && aj.vistas[1].columnas.join() === 'peso' && aj.vistas[1].orden.col === 'nombre', 'guardar la vista de ahora con su nombre');
aj = P.guardarVista(aj, 'revisiones del domingo', { estado: 'todos', filtros: {}, orden: {}, agrupar: '' });
check(aj.vistas.length === 2 && aj.vistas.at(-1).estado === 'todos', 'con el mismo nombre, la sustituye');
check(P.quitarVista(aj, aj.vistas[0].id).vistas.length === 1, 'quitar una vista');
let llena = P.limpiarAjustesPanel({});
for (let i = 0; i < 14; i++) llena = P.guardarVista(llena, `Vista ${i}`, {});
check(llena.vistas.length === P.MAX_VISTAS, `como mucho ${P.MAX_VISTAS} vistas`);
check(new TextEncoder().encode(JSON.stringify(llena)).length < 32768, 'y todo cabe en los 32 KB de la base');

// Recorrer desde la ficha y mensajes a varios
const v = P.vecinos(['a', 'b', 'c'], 'b');
check(v.anterior === 'a' && v.siguiente === 'c' && v.puesto === 2 && v.total === 3 && P.vecinos(['a'], 'a').siguiente === null && P.vecinos(['a'], 'z').puesto === 0, 'el anterior y el siguiente de la lista');
check(P.conNombre('Hola, {nombre}. ¿Qué tal, {NOMBRE}?', 'Ana López') === 'Hola, Ana. ¿Qué tal, Ana?', '{nombre} = su nombre de pila');

// ---------------------------------------------------------------- (v0.199) segunda tanda
console.log('\nAtletas, segunda tanda (v0.199): lo puro');
{
  // Avisos a tu medida
  const r1 = r('Uno', { ultimaSerie: '2026-11-17', bloque: { id: 'b' }, alertas: [{ tipo: 'sin_checkin', nivel: 'info', texto: 'Sin check-in' }], prioridad: 2, cumplimiento: { series: { pct: 85, pautadas: 40 } }, maxMolestia: 2 });
  check(P.conUmbrales(r1, P.UMBRALES, hoy) === r1, 'con los avisos de siempre, el atleta queda igual');
  const u = P.conUmbrales(r1, { dias: 3, cumplido: 90, molestia: 3, checkin: true }, hoy);
  check(u.alertas.some((a) => a.tipo === 'sin_entrenar' && a.texto === '3 días sin registrar series') && u.alertas.some((a) => a.tipo === 'cumplimiento') && u.alertas.find((a) => a.tipo === 'sin_checkin').nivel === 'aviso' && P.necesitaAtencion(u) && u.prioridad === 1,
    'tus avisos: 3 días, menos del 90 % y el check-in cuentan');
  const r2 = { ...carlos, alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso', texto: '15 días' }] };
  check(!P.conUmbrales(r2, { dias: 20, cumplido: 50 }, hoy).alertas.some((a) => a.tipo === 'sin_entrenar'), 'con 20 días, quien lleva 15 ya no salta');
  check(P.limpiarUmbrales({ dias: 0, cumplido: 'x', molestia: '3' }).dias === 5 && P.limpiarUmbrales({ molestia: '3' }).molestia === 3, 'umbrales limpios');

  // Recordatorios
  const ex2 = { recordatorios: { 'Ana López': { fecha: '2026-11-20', texto: 'Mirar rodilla' }, 'Carlos Vera': { fecha: '2026-11-26', texto: 'Llamarle' } } };
  check(P.recordatorioParaHoy(ana, ex2, hoy) && !P.recordatorioParaHoy(carlos, ex2, hoy), 'el recordatorio de hoy, para hoy; el de dentro de unos días, no');
  check(P.textoRecordatorio(ex2.recordatorios['Ana López'], hoy) === 'Hoy: Mirar rodilla' && P.textoRecordatorio(ex2.recordatorios['Carlos Vera'], hoy) === 'El 26/11: Llamarle' && P.textoRecordatorio({ fecha: '2026-11-18', texto: 'x' }, hoy) === 'Hace 2 días: x', 'el recordatorio, en palabras');
  check(P.limpiarRecordatorio({ fecha: 'mañana' }) === null && P.limpiarRecordatorio({ fecha: '2026-12-01', texto: '  ' }).texto === 'Mirar cómo va', 'recordatorios limpios');

  // Tarjetas, orden a mano
  check(P.limpiarTarjeta(['peso', 'raro', 'peso', 'hoy', 'hito', 'cumplido']).join() === 'peso,hoy,hito' && P.limpiarTarjeta([]).join() === 'sesiones,peso,ultimo', 'tarjetas: hasta tres datos; sin elegir, los de siempre');
  const om = P.moverManual(['a', 'b', 'c', 'd'], ['b', 'c'], 'c', -1);
  check(om.slice(0, 2).join() === 'c,b' && om.includes('a') && om.includes('d') && P.moverManual([], ['x', 'y'], 'x', -1).join() === 'x,y', 'tu orden a mano: mover entre los que ves');
  check(nombres(P.ordenar(base, { col: 'mano' }, { ordenManual: ['Marta Gil', 'Carlos Vera'] }, hoy)).startsWith('Marta,Carlos'), 'ordenar a tu manera');

  // Hoy toca, contacto, hito, novedades
  check(P.hoyTocaDe([{ dia_previsto: hoy, completada: false, nombre: 'Torso A' }], hoy).nombre === 'Torso A' && P.hoyTocaDe([{ dia_previsto: '2026-11-19', completada: true, fecha_realizada: hoy, nombre: 'Pierna' }], hoy).hecha === true && P.hoyTocaDe([{ dia_previsto: '2026-11-21' }], hoy) === null, 'hoy toca: la prevista hoy o la hecha hoy');
  check(P.textoContacto({ fecha: '2026-11-17', autor: 'coach' }, hoy) === 'Hace 3 días (tú)' && P.textoContacto(null, hoy) === 'Nunca', 'el último contacto');
  const h1 = P.proximoHito({ ...ana, fecha_alta: '2025-11-25' }, { cumple: { mes: 11, dia: 30 }, carreras: [{ nombre: 'San Silvestre', fecha: '2026-12-31' }] }, hoy);
  check(h1?.tipo === 'aniversario' && h1.dias === 5 && P.textoHito(h1) === '1 año con FBE, en 5 días', `el próximo hito, el que antes llegue (${P.textoHito(h1)})`);
  check(P.proximoHito(ana, { cumple: { mes: 11, dia: 21 } }, hoy).texto === 'Su cumpleaños' && P.proximoHito({ ...ana, semana: { numero: 6, total: 6 } }, {}, hoy).texto === 'Última semana del bloque' && P.proximoHito(ana, { cumple: { mes: 1, dia: 15 } }, hoy) === null, 'cumpleaños, fin de bloque, y nada si queda lejos');
  check(P.proximoHito({ ...ana, cobro: { pagadoHasta: '2026-11-22' } }, {}, hoy).tipo === 'pago' && P.proximoHito(ana, { carreras: [{ nombre: 'Getafe', fecha: '2026-11-29' }] }, hoy).texto === 'Carrera: Getafe', 'un pago que vence y una carrera');
  const nv = P.novedadesDe({ ...ana, ultimaSerie: '2026-11-20', checkin: { semana: '2026-11-16', creado: '2026-11-20T09:00:00Z' }, peso: { fecha: '2026-11-19' } }, { contacto: { 'Ana López': { autor: 'atleta', instante: '2026-11-20T10:00:00Z' } } }, '2026-11-19T20:00:00Z');
  check(nv.join() === 'Ha entrenado,Check-in nuevo,Te ha escrito' && P.novedadesDe(ana, {}, null).length === 0, `lo nuevo desde tu última visita (${nv.join(', ')})`);

  // Filtros por rango y marcas nuevas
  const fr = P.limpiarFiltros({ minDias: '10', maxCumplido: 0, minMeses: 'x' });
  check(fr.minDias === 10 && fr.maxCumplido === null && fr.minMeses === null && P.cuantosFiltros(fr) === 1, 'filtros por rango, limpios');
  const masDe10 = base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, minDias: 10 }, {}, hoy)).map((x) => x.nombre.split(' ')[0]).join();
  check(masDe10 === 'Carlos,Marta,Iván' && base.filter((x) => P.cumpleFiltros(x, { ...P.FILTROS_VACIOS, maxCumplido: 80 }, {}, hoy)).map((x) => x.nombre.split(' ')[0]).join() === 'Carlos',
    `más de 10 días sin entrenar (${masDe10}); menos del 80 % cumplido`);
  check(P.cumpleMarca('ultimaSemana', { ...ana, semana: { numero: 6, total: 6 } }, {}, hoy) && P.cumpleMarca('hoyToca', ana, { hoy: { 'Ana López': { hecha: false } } }, hoy) && P.cumpleMarca('progresoRojo', ana, { progreso: { 'Ana López': { rojos: 1 } } }, hoy), 'las marcas nuevas');
  check(P.CONTADORES.length === 8 && P.CONTADORES.includes('paraHoy') && P.CONTADORES.includes('novedades'), 'ocho contadores');

  // Medias, CSV y mensajes con datos
  check(P.resumenColumna('cumplido', [ana, carlos], {}, hoy) === '87 % de media' && P.resumenColumna('checkin', [ana, carlos], {}, hoy) === '1 de 2 al día' && P.resumenColumna('peso', [ana], {}, hoy) === '', 'las medias del pie de la tabla');
  const csv = P.csvLista([ana, { ...carlos, nombre: '=Carlos; "Vera"' }], ['peso', 'cumplido'], extra, hoy);
  check(csv.startsWith('﻿Atleta;Etiquetas;Peso;% cumplido') && csv.includes('Ana López;Media maratón, preboda;61,7;99') && csv.includes(`"'=Carlos; ""Vera"""`), 'el CSV: con tildes, punto y coma, comillas y sin fórmulas');
  check(P.rellenarVarios('{nombre}, semana {semana}: {sesiones}, {cumplido}, {dias} días', ana, hoy) === 'Ana, semana 4 de 6: 0 de 3, 99 %, 2 días', 'mensajes con los datos de cada uno');
  check(P.limpiarAjustesPanel({ recordatorios: { 'no-es-id': { fecha: '2026-11-20' }, '11111111-2222-3333-4444-555555555555': { fecha: '2026-11-20', texto: 'x' } } }).recordatorios['11111111-2222-3333-4444-555555555555'].texto === 'x'
    && P.limpiarAjustesPanel({ tablero: 1 }).tablero === true && Object.keys(P.limpiarAjustesPanel({ recordatorios: { x: { fecha: '2026-11-20' } } }).recordatorios).length === 0, 'los ajustes nuevos, limpios');
}

console.log('\nAtletas a tu gusto (v0.198): contra la demo (como la 085)');
{
  const backend = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  await backend.auth.entrar('pelayo@fbe.demo', 'demo');
  const api = crearApi(backend);
  check(await api.panel085() === true, 'la demo ya tiene la 085');
  const res = await api.resumenes();
  const [a1, a2] = res;
  check('nivel' in a1 && 'carrera' in a1, 'el resumen trae el nivel y si le llevas la carrera');
  await api.guardarPanelAtleta(a1.atleta_id, { fijado: true, etiquetas: ['Preboda', 'preboda', ' Media maratón '], nota: ' Revisar rodilla ' });
  let pa = await api.panelAtletas();
  check(pa.atletas[a1.atleta_id]?.fijado === true && pa.atletas[a1.atleta_id].etiquetas.join() === 'Preboda,Media maratón' && pa.atletas[a1.atleta_id].nota === 'Revisar rodilla', 'lo de un atleta se guarda limpio');
  await api.guardarPanelAtleta(a1.atleta_id, { fijado: false, etiquetas: ['Preboda'], nota: null });
  pa = await api.panelAtletas();
  check(pa.atletas[a1.atleta_id].fijado === false && pa.atletas[a1.atleta_id].etiquetas.join() === 'Preboda', 'y se cambia (una fila por atleta)');
  await api.guardarPanelAtleta(a1.atleta_id, { fijado: false, etiquetas: [], nota: '' });
  pa = await api.panelAtletas();
  check(!pa.atletas[a1.atleta_id], 'sin nada, su fila se borra');
  let mal = null;
  try { await backend.insert('atletas_panel', [{ atleta_id: a2.atleta_id, fijado: false, etiquetas: [], nota: null }]); } catch (e) { mal = e.message; }
  let mal2 = null;
  try { await backend.insert('atletas_panel', [{ atleta_id: a2.atleta_id, fijado: true, etiquetas: Array.from({ length: 9 }, (_, i) => `e${i}`), nota: null }]); } catch (e) { mal2 = e.message; }
  check(!!mal && !!mal2, 'la base no admite filas vacías ni más de 8 etiquetas');
  check(await api.guardarPanelAjustes({ columnas: ['peso', 'nota'], vistas: [{ nombre: 'Lunes de programar', filtros: { marcas: ['porProgramar'] } }] }) === true, 'tus ajustes de la lista se guardan');
  pa = await api.panelAtletas();
  check(pa.ajustes.columnas.join() === 'peso,nota' && pa.ajustes.vistas[0]?.nombre === 'Lunes de programar', 'y vuelven igual');
  await api.guardarPanelAjustes({ columnas: ['avisos'] });
  check((await api.panelAtletas()).ajustes.columnas.join() === 'avisos', 'una fila por coach (se sustituye)');
  // El atleta no ve nada de esto
  const b2 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  const api2 = crearApi(b2);
  const r2 = await api2.resumenes();
  await api2.guardarPanelAtleta(r2[0].atleta_id, { etiquetas: ['Privada'], nota: 'Solo para mí' });
  await api2.guardarPanelAjustes({ compacta: true });
  await b2.auth.salir();
  await b2.auth.entrar('ana@fbe.demo', 'demo');
  const ve = await b2.select('atletas_panel', {}).catch(() => []);
  const veAj = await b2.select('panel_ajustes', {}).catch(() => []);
  let noPuede = null;
  try { await b2.insert('atletas_panel', [{ atleta_id: r2[0].atleta_id, fijado: true, etiquetas: [], nota: null }]); } catch (e) { noPuede = e.message; }
  check(!ve.length && !veAj.length && !!noPuede, 'un atleta no ve ni escribe lo del coach');
  // Al borrar un atleta se va lo suyo
  await b2.auth.salir();
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  await api2.borrarAtleta(r2[0].atleta_id).catch(() => {});
  check(!(await b2.select('atletas_panel', {})).some((x) => x.atleta_id === r2[0].atleta_id), 'al borrar un atleta, su fila se va');
  // (v0.199) hoy toca, hitos y preparar la semana que viene de varios en borrador
  const hoyT = await api2.hoyTocaEquipo(r2.filter((x) => x.semana).map((x) => ({ atleta_id: x.atleta_id, semana_id: x.semana.id })), hoy);
  check(Object.values(hoyT).every((h) => typeof h.hecha === 'boolean' && h.nombre), 'hoy toca, de cada uno');
  const hi = await api2.hitosEquipo(r2.map((x) => x.atleta_id), hoy);
  check(hi && typeof hi.cumples === 'object' && typeof hi.carreras === 'object', 'los datos para el próximo hito');
  const conBloque = r2.filter((x) => x.bloque && x.estado === 'activo').map((x) => x.atleta_id);
  const antesPub = (await b2.select('semanas', {})).filter((w) => w.programacion === 'programada').length;
  const prep = await api2.prepararSiguienteVarios(conBloque, { kg: 'igual' });
  const prep2 = await api2.prepararSiguienteVarios(conBloque, { kg: 'igual' });
  check(prep.length === conBloque.length && prep.every((x) => ['hecha', 'ya', 'sin_bloque'].includes(x.estado)) && prep2.every((x) => x.estado !== 'hecha'), `preparar la semana que viene de varios: ${prep.map((x) => x.estado).join(', ')}; la segunda vez, ya la tienen`);
  check((await b2.select('semanas', {})).filter((w) => w.programacion === 'programada').length === antesPub, 'y no publica nada (quedan en borrador)');
  // La semana que viene, para los contadores
  const conB = r2.filter((x) => x.bloque);
  const px = await api2.proximaSemanaDe(conB.map((x) => ({ atleta_id: x.atleta_id, bloque_id: x.bloque.id })), (await import('../web/src/logica/fechas.js')).lunesDe(hoy));
  check(conB.every((x) => [null, 'publicada', 'borrador', 'sin'].includes(px[x.atleta_id] ?? null)), 'la semana que viene de cada uno');
}

// Las reglas de la lista no tocan otras pantallas: cada selector de atletas-lista.css lleva al menos una clase
// propia de la lista (o de la tabla y las tarjetas de atletas). Una clase suelta que ya se usa en otro sitio
// (.etq, .fila-entre, .elegir-atleta...) cambiaba también las etiquetas de los formularios, el chat o la revisión.
{
  console.log('\nLa hoja de la lista no se sale de la lista');
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../web/src/', import.meta.url);
  const propias = new Set(['web/src/ui/coach/Panel.jsx', 'web/src/ui/coach/PanelLista.jsx']);
  const deLaLista = new Set(['atletas-tabla', 'tarjeta-atleta', 'vecinos-ficha']);   // la de la ficha, solo para el anterior/siguiente
  const quitar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const otrasCss = readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'atletas-lista.css').map((f) => quitar(readFileSync(new URL(f, dir), 'utf8'))).join('\n');
  const jsx = [];
  const andar = (d, rel) => { for (const e of readdirSync(d, { withFileTypes: true })) { const r2 = `${rel}/${e.name}`; if (e.isDirectory()) andar(new URL(`${e.name}/`, d), r2); else if (/\.jsx?$/.test(e.name) && !propias.has(r2)) jsx.push(readFileSync(new URL(e.name, d), 'utf8')); } };
  andar(new URL('ui/', dir), 'web/src/ui');
  const otroJsx = jsx.join('\n');
  const usada = (k) => new RegExp(`\\.${k}(?![\\w-])`).test(otrasCss) || new RegExp(`class(?:Name)?=[^\\n>]*[\\s"'\\x60{]${k}(?![\\w-])`).test(otroJsx);
  const hoja = quitar(process.env.HOJA_LISTA ? readFileSync(process.env.HOJA_LISTA, 'utf8') : readFileSync(new URL('atletas-lista.css', dir), 'utf8'));
  const selectores = [];
  for (const m of hoja.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const cab = m[1].trim();
    if (!cab || cab.startsWith('@')) continue;
    for (const s of cab.split(',')) selectores.push(s.trim());
  }
  // Dentro de @media, el bloque interior tambien se lee arriba (el regex coge la regla mas interna)
  const fuera = selectores.filter((s) => {
    const clases = [...s.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((x) => x[1]);
    if (!clases.length) return /^(html|body|:root|main)\b/.test(s);
    return clases.every((k) => !deLaLista.has(k) && usada(k));
  });
  check(selectores.length > 100, `se leen las reglas de la hoja (${selectores.length} selectores)`);
  check(fuera.length === 0, `ningún selector usa solo clases de otras pantallas${fuera.length ? `: ${fuera.slice(0, 6).join(' | ')}` : ''}`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
