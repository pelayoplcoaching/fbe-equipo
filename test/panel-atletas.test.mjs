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
  // La semana que viene, para los contadores
  const conB = r2.filter((x) => x.bloque);
  const px = await api2.proximaSemanaDe(conB.map((x) => ({ atleta_id: x.atleta_id, bloque_id: x.bloque.id })), (await import('../web/src/logica/fechas.js')).lunesDe(hoy));
  check(conB.every((x) => [null, 'publicada', 'borrador', 'sin'].includes(px[x.atleta_id] ?? null)), 'la semana que viene de cada uno');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
