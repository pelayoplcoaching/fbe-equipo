// La demo (backend en memoria + datos de ejemplo) responde igual que la app real a las mismas funciones.
import { VERSION_LEGAL as VERSION_LEGAL_D } from '../web/src/legal.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const igualD = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const igual = igualD;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);

console.log('Coach en la demo');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.perfil()).rol === 'coach', 'entra como coach');
const res = await api.resumenes();
check(res.length === 7, '7 atletas en el panel (con Lucía, solo nutrición, Sergio, de baja desde hace dos meses: v0.48, e Iván, por microciclos: v0.53)');
check(res.find((r) => r.nombre === 'Lucía Ferrer')?.servicio === 'nutricion' && !res.find((r) => r.nombre === 'Lucía Ferrer').alertas.some((a) => ['sin_bloque', 'sin_entrenar', 'publicar'].includes(a.tipo)), 'Lucía, solo nutrición: sin avisos de entrenamiento');
check(res.find((r) => r.nombre === 'Lucía Ferrer').alertas.some((a) => a.tipo === 'receta'), 'Lucía pide cambiar una receta (aviso en el panel)');
for (const r of res) console.log('    ', r.nombre.padEnd(14), r.semana ? `S${r.semana.numero}/${r.semana.total}` : '—', `${r.sesiones.completadas}/${r.sesiones.total}`, r.peso ? `${r.peso.kg} (${r.peso.cambio})` : '', '|', r.alertas.map((a) => a.texto).join(' · '));
check(res.find((r) => r.nombre === 'Carlos Vera').alertas.some((a) => a.tipo === 'sin_entrenar'), 'Carlos aparece sin entrenar');
// v0.49: la franja y las minigráficas del panel, y el resumen de un solo atleta para la cabecera de su ficha
{
  const { estadoAtleta } = await import('../web/src/logica/visual.js');
  const ana = res.find((r) => r.nombre === 'Ana López');
  check(res.every((r) => r.chispas && Array.isArray(r.chispas.peso) && r.chispas.sesiones.length === 6) && ana.chispas.peso.length >= 2 && ana.chispas.sesiones.some((w) => w.hechas > 0),
    `cada atleta trae sus minigráficas (Ana: ${ana.chispas.peso.length} semanas de peso, ${ana.chispas.sesiones.map((w) => `${w.hechas}/${w.total}`).join(' ')})`);
  check(estadoAtleta(res.find((r) => r.nombre === 'Carlos Vera')) === 'rojo' && estadoAtleta(res.find((r) => r.estado === 'baja')) === 'gris', 'Carlos, sin entrenar, en rojo; quien está de baja, en gris');
  const solo = await api.resumenes(undefined, { soloAtleta: ana.atleta_id });
  check(solo.length === 1 && solo[0].atleta_id === ana.atleta_id && igualD(solo[0].chispas, ana.chispas) && solo[0].cumplimiento?.series?.pct === ana.cumplimiento?.series?.pct, 'el resumen de un solo atleta es el mismo que en el panel');
}
check(res.find((r) => r.nombre === 'Rubén Martín').alertas.some((a) => a.tipo === 'molestia'), 'Rubén aparece con molestia moderada');
check(res.find((r) => r.nombre === 'Marta Gil').estado === 'invitado', 'Marta está pendiente de activar');
check((await api.plantillas()).length === 2, '2 plantillas');
const bandeja = await api.bandeja();
check(bandeja.comentarios.length === 1 && bandeja.comentarios[0].atleta.nombre === 'Rubén Martín', 'bandeja: el comentario de Rubén sin leer');
check(bandeja.sesiones.length >= 3 && bandeja.checkins.length >= 2, `bandeja: ${bandeja.sesiones.length} sesiones y ${bandeja.checkins.length} check-ins por revisar`);
{
  const conPoster = bandeja.archivos.find((x) => x.poster_ruta);
  check(!!conPoster && conPoster.duracion_seg > 0 && /^blob:/.test(String(await api.urlArchivo(conPoster.poster_ruta).catch(() => 'no'))), 'v0.50: el vídeo de Ana en la bandeja trae su miniatura y su duración');
}
check((await api.recursos()).filter((r) => r.categoria === 'faq').length === 15, 'las 15 preguntas frecuentes de la app (también cómo escribir al coach, cómo apuntar el cardio y el peso anterior)');

console.log('\nAtleta en la demo');
await b.auth.entrar('ana@fbe.demo', 'demo');
const ana = await api.miAtleta();
const prog = await api.programa(ana.id);
check(prog.semanas.length === 4 && prog.actual.numero === 4, 'Ana ve 4 semanas programadas y está en la 4');
const sesionesActual = prog.sesiones[prog.actual.id];
check(sesionesActual.filter((s) => s.completada).length >= 1, 'lleva sesiones hechas esta semana');
const siguiente = sesionesActual.find((s) => !s.completada);
const det = await api.sesion(siguiente.id, ana.id);
check(det.ejercicios[0].ultimas?.series.length > 0, `ve lo que hizo la última vez en ${det.ejercicios[0].ejercicio.nombre}`);
const pr = await api.progreso(ana.id);
check(pr.ejercicios.length >= 10 && pr.pesos.length >= 20, `progreso: ${pr.ejercicios.length} ejercicios con e1RM y ${pr.pesos.length} pesos (casi a diario el último mes)`);
check((await api.checkin(ana.id, lunesDe(hoyISO()))).pesos.length === 2, 'check-in con sus últimos pesos');
const noLeidosAna = await api.noLeidos(ana.id);
check(noLeidosAna.length === 2 && noLeidosAna.some((c) => c.sesion_id) && noLeidosAna.some((c) => !c.sesion_id && !c.checkin_id && !c.archivo_id), 'tiene dos respuestas del coach sin leer: una en una sesión y un mensaje general (v0.17)');
const generalAna = await api.comentarios({ atletaId: ana.id });
check(generalAna.length === 2 && generalAna[0].autor === 'atleta' && generalAna[1].autor === 'coach', 'su conversación general con el coach tiene su pregunta y la respuesta');
// Cardio (v0.17): Carlos tiene un rodaje por semana, con lo hecho en las semanas pasadas
const carlosV = (await api.atletas()).find((a) => a.nombre === 'Carlos Vera');
const cardioCarlos = await api.cardioSemanas(carlosV.id, 8);
check(cardioCarlos.length === 8 && cardioCarlos.some((w) => w.minutos > 0 && w.km > 0), `Carlos: cardio por semana, ${cardioCarlos.filter((w) => w.sesiones).length} semanas con rodaje`);
const progCarlos = await api.programa(carlosV.id);
const rodaje = Object.values(progCarlos.sesiones).flat().find((x) => x.tipo === 'cardio');
check(rodaje && rodaje.cardio.modalidad === 'carrera' && rodaje.cardio.minutos >= 30, 'su rodaje semanal lleva la pauta del coach');
check((await api.medidas(ana.id)).length === 3 && (await api.objetivos(ana.id)).length === 3 && (await api.marcas(ana.id)).length === 2, 'medidas, objetivos y marcas');
await api.comentar({ atletaId: ana.id, sesionId: siguiente.id, texto: 'Hoy entreno por la mañana', autor: 'coach' });
const hilo = await api.comentarios({ sesionId: siguiente.id });
check(hilo[0].autor === 'atleta', 'en la demo el autor también lo decide quién escribe');

console.log('\nv0.3 en la demo');
// v0.50: la demo da lo mismo para las tarjetas de Semana y la miniatura del vídeo de Ana en la bandeja
{
  const pr = await api.programa(ana.id);
  const ids = (pr.sesiones[pr.actual.id] || []).map((x) => x.id);
  const pt = await api.pautasSemana(ids);
  check(ids.length > 0 && ids.every((id) => pt[id].ejercicios > 0 && pt[id].minutos > 0 && pt[id].grupos.length > 0 && pt[id].patrones.length > 0), 'Semana en la demo: cada sesión con sus minutos, músculos y pictogramas');
}
const prog3 = await api.programa(ana.id);
const pierna = Object.values(prog3.sesiones).flat().find((x) => x.nombre === 'Pierna A');
const detPierna = await api.sesion(pierna.id, ana.id);
check(detPierna.ejercicios.filter((e) => e.superserie === 'A').length === 2, 'Pierna A trae una superserie (leg curl y gemelo)');
const cons = await api.constancia(ana.id);
check(cons.racha >= 1 && cons.diasEntrenados > 0, `racha de semanas completas (${cons.racha}) y calendario de 12 semanas`);
// v0.49: las sesiones hechas, ligeras (el calendario de 16 semanas y la última vez de una sesión), igual que las del historial
{
  const todas = await api.entrenamientos(ana.id);
  const desde = sumarDias(lunesDe(hoyISO()), -7 * 15);
  const ligeras = await api.sesionesHechas(ana.id, { desde });
  const esperadas = todas.filter((x) => x.fecha >= desde);
  check(ligeras.length === esperadas.length && ligeras.length > 0 && ligeras.every((x) => { const y = todas.find((z) => z.id === x.id); return y && y.fecha === x.fecha && y.series === x.series && Math.abs(y.tonelaje - x.tonelaje) < 1e-6; }),
    `sesionesHechas desde una fecha: las mismas ${ligeras.length} sesiones, con sus series y tonelaje, sin cargar el historial entero`);
  const nombre = todas[0].nombre;
  const deNombre = await api.sesionesHechas(ana.id, { nombre, limite: 2 });
  check(deNombre.length >= 1 && deNombre.length <= 2 && deNombre.every((x) => x.nombre === nombre) && deNombre[0].fecha >= (deNombre[1]?.fecha || ''), `y las de un nombre (${nombre}), las más recientes primero y como mucho las pedidas`);
}
const vitDemo = await api.vitrina(ana.id);
check(vitDemo.ejercicios.length > 5 && vitDemo.recientes.length > 0, 'vitrina de récords con récords recientes');
check(igualD((await api.progreso(ana.id)).volumenObjetivo, { espalda: [12, 22], gluteo: [6, 14] }), 'volumen objetivo propio de Ana');
const [ckDemo] = await b.select('checkins', { eq: { atleta_id: ana.id } });
{
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.comentar({ atletaId: ana.id, checkinId: ckDemo.id, texto: 'Bien la semana', autor: 'coach' });
  await b.auth.entrar('ana@fbe.demo', 'demo');
  await api.borrar('checkins', ckDemo.id);
  check((await api.comentarios({ atletaId: ana.id })).some((c) => c.texto === 'Bien la semana'), 'si borra el check-in, la respuesta del coach se queda');
}
await b.auth.entrar('pelayo@fbe.demo', 'demo');
await api.actualizar('atletas', ana.id, { estado: 'baja' });
await b.auth.entrar('ana@fbe.demo', 'demo');
let bajaBloquea = false;
try { await api.guardarMarca({ atleta_id: ana.id, ejercicio_id: detPierna.ejercicios[0].ejercicio_id, kg: 50 }); } catch { bajaBloquea = true; }
check(bajaBloquea, 'de baja no puede añadir nada');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
await api.actualizar('atletas', ana.id, { estado: 'activo' });
await b.auth.entrar('ana@fbe.demo', 'demo');

console.log('\nv0.4 en la demo');
check(Object.keys(await api.notasEjercicio(ana.id)).length === 3, 'Ana tiene tres notas fijadas');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.respuestasGuardadas()).length === 5, 'el coach tiene cinco respuestas guardadas de ejemplo');
const cDemo = await api.carga(ana.id);
check(cDemo.semanas.filter((w) => w.carga > 0).length >= 3 && cDemo.cambio, 'carga semanal de Ana con comparación');
const rDemo = (await api.resumenes()).find((x) => x.nombre === 'Ana López');
check(rDemo.peso.ritmo && Math.abs(rDemo.peso.ritmo.kgSemana) < 1, `ritmo de peso de Ana (${rDemo.peso.ritmo?.kgSemana} kg/semana)`);
await b.auth.entrar('ana@fbe.demo', 'demo');

console.log('\nv0.5 en la demo');
const entrenos = await api.entrenamientos(ana.id);
check(entrenos.length >= 8 && entrenos.every((x, i) => i === 0 || (entrenos[i - 1].fecha || '') >= (x.fecha || '')), `historial de Ana: ${entrenos.length} entrenamientos, del más reciente al más antiguo`);
check(entrenos.some((x) => x.records > 0) && entrenos.every((x) => x.series > 0), 'con sus series y los récords de cada sesión');
const semanasAna = await api.resumenesSemanales(ana.id);
check(semanasAna.length >= 1 && semanasAna.every((r, i) => r.lunes < lunesDe(hoyISO()) && (i === 0 || semanasAna[i - 1].lunes > r.lunes)), `Tu semana: ${semanasAna.length} semanas ya cerradas, de la más reciente a la más antigua`);
check(semanasAna.every((r) => r.sesiones.hechas > 0 && r.tonelaje > 0 && r.series > 0 && r.musculoTop), 'cada semana con sesiones, tonelaje, series y su músculo más trabajado');
check(semanasAna[0].peso && Math.abs(semanasAna[0].peso.cambio) < 1.5, `y la tendencia de su peso (${semanasAna[0].peso?.cambio} kg)`);
const diaDemo = await api.tuDia(ana.id, { programa: prog, checkin: await api.checkin(ana.id, lunesDe(hoyISO())) });
check(diaDemo.length >= 4 && diaDemo.some((x) => x.id === 'habitos') && diaDemo.some((x) => x.id === 'nutricion'), `Tu día de Ana: ${diaDemo.map((x) => `${x.id} (${x.estado})`).join(', ')}`);
const pasosDemo = await api.primerosPasos(ana.id);
check(pasosDemo.sesion && pasosDemo.peso && pasosDemo.checkin, 'Ana ya ha dado todos los primeros pasos');

console.log('\nv0.6 en la demo');
const logrosAna = await api.logros(ana.id);
check(logrosAna.lista.length === 7 && logrosAna.lista.reduce((t, l) => t + l.nivel, 0) >= 6, `Ana tiene ${logrosAna.lista.reduce((t, l) => t + l.nivel, 0)} discos de 28`);
// v0.51: el dial «Carga» de Hoy: solo las sesiones terminadas de las últimas semanas, con las columnas de la carga, y lo
// mismo con los bloques que ya trae el programa (una consulta menos) que sin ellos
const cargaA = await api.cargaHoy(ana.id);
const progA = await api.programa(ana.id);
const cargaB = await api.cargaHoy(ana.id, { bloques: progA.bloques });
check(cargaA.length >= 4 && cargaA.every((x) => x.completada && Object.keys(x).sort().join() === 'completada,duracion_min,fecha_realizada,id,rpe_sesion') && JSON.stringify(cargaA.map((x) => x.id).sort()) === JSON.stringify(cargaB.map((x) => x.id).sort()),
  `el dial de carga lee ${cargaA.length} sesiones terminadas, solo con las columnas que necesita (también con los bloques del programa)`);
const infAna = await api.informes(ana.id);
check(infAna.length >= 1 && infAna[0].principales.length >= 3 && infAna[0].principales.every((x) => x.cambio != null), 'informe de su bloque con la fuerza estimada de sus ejercicios principales');
const sesAna = (await api.entrenamientos(ana.id))[0];
check(!!(await api.sesion(sesAna.id, ana.id)).sesion.preparacion, 'sus sesiones traen cómo llegó');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const resDemo = await api.resumenes();
const carlos = resDemo.find((x) => x.nombre === 'Carlos Vera');
// (según el día de la semana, la ventana de 4 semanas acabadas cambia: el aviso puede ser de cumplimiento o de días sin entrenar)
check(carlos.alertas.some((a) => a.tipo === 'cumplimiento' || a.tipo === 'sin_entrenar'), `Carlos: ${carlos.cumplimiento.series.pct} % de lo pautado y aviso en el panel`);
check(resDemo.find((x) => x.nombre === 'Ana López').cumplimiento.series.pct >= 90, 'Ana cumple casi todo');
const band = await api.bandeja();
check(band.sesiones.some((x) => x.preparacion?.molestias === 1), 'en Revisar, la última sesión de Rubén dice que llegó con molestias');
await b.auth.entrar('ana@fbe.demo', 'demo');
const consAna = (await api.consentimientos()).find((c) => c.tipo === 'datos_salud' && !c.revocado_en);
await api.revocarConsentimiento(consAna.id);
let rechazada = false;
try { await api.guardarPreparacion(sesAna.id, { sueno: 2, energia: 2, molestias: 2 }); } catch { rechazada = true; }
check(rechazada, 'sin consentimiento de salud, la demo tampoco la guarda');
const actualPrep = (await api.sesion(sesAna.id, ana.id)).sesion.preparacion;
check(!(await lanza(() => api.guardarPreparacion(sesAna.id, actualPrep))) && !(await lanza(() => api.guardarPreparacion(sesAna.id, null))), 'pero sí reenviar lo que había o vaciarla, como en la base');
await api.darConsentimientos(['datos_salud']);
check(await lanza(() => api.guardarPreparacion(sesAna.id, { sueno: 1, energia: 2 })) && await lanza(() => api.guardarPreparacion(sesAna.id, { sueno: 1, energia: 2, molestias: 3, nota: 'rodilla' })), 'y exige la misma forma que la base (tres respuestas, nada más)');

console.log('\nv0.7 en la demo');
check((await api.avisos(ana.id)).length === 1, 'Ana ve el aviso general del coach');
const vidsAna = await api.archivos(ana.id, 'video_tecnica');
check(vidsAna.length === 3 && vidsAna.some((v) => v.destacado) && /^(data:video\/mp4|blob:)/.test(await api.urlArchivo(vidsAna[0].ruta)), 'la demo trae tres vídeos de técnica de ejemplo (uno destacado) que se pueden ver');
const diarioDemo = await api.diario(ana.id);
check(diarioDemo.length === 6 && diarioDemo.every((a) => a.tipo !== 'adjunto') && diarioDemo.filter((a) => a.tipo === 'video_tecnica').every((a) => a.ejercicio?.nombre), 'su diario: 3 vídeos con su ejercicio y 3 fotos, sin los adjuntos del chat');
const convDemo = await api.conversacion(ana.id);
check(convDemo.some((c) => c.archivo?.tipo === 'adjunto' && /^image\//.test(c.archivo.mime)) && convDemo.some((c) => c.contexto?.tipo === 'sesion'), 'su chat junta la foto del hotel y los comentarios de las sesiones');
check(convDemo.find((c) => c.archivo?.tipo === 'adjunto')?.adjunto === true && api.esMensaje(convDemo.find((c) => c.archivo?.tipo === 'adjunto')) && !api.esMensaje(convDemo.find((c) => c.contexto?.tipo === 'sesion')),
  'la foto del chat cuenta como mensaje (insignia de Mensajes); el comentario de una sesión, como respuesta en Hoy');
{
  const nuevo = await api.enviarMensaje(ana.id, { texto: 'Prueba', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  check(nuevo.adjunto === true, 'en la demo, el mensaje de un adjunto nace marcado como en la base real');
  await api.borrarArchivo((await b.select('archivos', { eq: { id: nuevo.archivo_id } }))[0]);
  check((await b.select('comentarios', { eq: { id: nuevo.id } })).length === 1, '(v0.54) borrar desde archivos la foto del chat con su mensaje no hace nada: va por «eliminar para todos»');
  check((await api.eliminarMensaje(nuevo)).estado === 'eliminado' && (await b.select('archivos', { eq: { id: nuevo.archivo_id } })).length === 0, 'y eliminándola para todos, la foto se va');
}
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const rubenDemo = (await api.atletas()).find((a) => a.nombre === 'Rubén Martín');
check((await api.archivos(rubenDemo.id, 'video_tecnica')).length === 2, 'Rubén tiene dos vídeos (para «Comparar dos»)');
await api.crear('avisos', { texto: 'Rubén: cambia el peso muerto por hip thrust esta semana', atleta_id: rubenDemo.id });
const comRuben = (await api.comentarios({ atletaId: rubenDemo.id, archivoId: (await api.archivos(rubenDemo.id, 'video_tecnica'))[0].id }));
check(comRuben.some((c) => /0:01,5/.test(c.texto)), 'la corrección de Rubén lleva momentos del vídeo');
await b.auth.entrar('ana@fbe.demo', 'demo');
check((await api.avisos(ana.id)).length === 1, 'el aviso personal de Rubén no le llega a Ana');

console.log('\nv0.8 en la demo: objetivos que avanzan solos, fotos, actividad y tempo');
{
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const anaD = (await api.atletas()).find((a) => a.nombre.startsWith('Ana'));
  const obs = await api.objetivos(anaD.id);
  const banca = obs.find((o) => /Press banca/.test(o.titulo)), sent = obs.find((o) => /Sentadilla/.test(o.titulo));
  check(banca?.auto && banca.auto.pct > 50 && banca.auto.pct < 100 && banca.auto.prevision, `press banca de Ana: ${banca?.auto?.pct} % con previsión`);
  check(sent?.auto && sent.auto.pct > 20 && sent.auto.pct < banca.auto.pct, `sentadilla de Ana: ${sent?.auto?.pct} %, por detrás`);
  check(obs.some((o) => !o.ejercicio_id && !o.auto), 'el objetivo de peso sigue siendo manual');
  const fotos = await api.archivos(anaD.id, 'foto_progreso');
  check(fotos.length === 3 && (await Promise.all(fotos.map((f) => api.urlArchivo(f.ruta)))).every((u) => /^(data:image\/jpeg|blob:)/.test(u)), 'Ana tiene 3 fotos de progreso de ejemplo para el antes y después');
  const act = await api.actividad(anaD.id);
  check(['sesion', 'record', 'checkin', 'peso', 'mensaje'].every((t) => act.some((e) => e.tipo === t)), 'su actividad mezcla sesiones, récords, check-ins, pesos y mensajes');
  const prog = await api.programa(anaD.id);
  const pautasConTempo = [];
  for (const ss of Object.values(prog.sesiones)) for (const se of ss) pautasConTempo.push(...(await api.sesion(se.id, anaD.id)).ejercicios.filter((e) => e.tempo));
  check(pautasConTempo.some((e) => e.tempo === '3-1-1' && /rumano/i.test(e.ejercicio.nombre)), 'el peso muerto rumano lleva tempo 3-1-1 para el metrónomo');
  const [ej] = await api.biblioteca();
  const ob = await api.crear('objetivos', { atleta_id: anaD.id, titulo: 'Prueba', ejercicio_id: ej.id, kg_objetivo: 50, reps_objetivo: 5 });
  check(await lanza(() => api.actualizar('objetivos', ob.id, { reps_objetivo: 15 })), 'la demo tampoco acepta marcas de más de 12 repeticiones');
  await api.actualizar('objetivos', ob.id, { ejercicio_id: null });
  check((await api.objetivos(anaD.id)).find((o) => o.id === ob.id).kg_objetivo === null, 'y sin ejercicio se limpia la marca, como en Supabase');
  await api.borrar('objetivos', ob.id);
}

console.log('\nv0.9 en la demo: rechaza lo mismo que la base');
{
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const anaD = (await api.atletas()).find((a) => a.nombre.startsWith('Ana'));
  const prog = await api.programa(anaD.id, { soloProgramadas: false });
  const unaSesion = Object.values(prog.sesiones).flat()[0];
  const pauta = (await api.sesion(unaSesion.id, anaD.id)).ejercicios[0];
  check(await lanza(() => api.actualizar('sesion_ejercicios', pauta.id, { series: 25 })), 'más de 20 series en una pauta: la demo lo rechaza, como Supabase');
  check(await lanza(() => api.actualizar('sesion_ejercicios', pauta.id, { reps_min: 12, reps_max: 8 })), 'un rango de repeticiones al revés, también');
  check(await lanza(() => api.actualizar('semanas', prog.semanas[0].id, { foco: 'mixto' })), '«Mixto» no vale como foco de una semana');
  check(!(await lanza(() => api.actualizar('sesion_ejercicios', pauta.id, { series: pauta.series }))), 'lo que sí vale se guarda');
}

console.log('\nv0.10 en la demo');
{
  const { queToca } = await import('../web/src/logica/plan.js');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const panel = await api.resumenes();
  check(panel.find((r) => r.nombre === 'Rubén Martín').alertas.some((a) => a.tipo === 'habitos'), 'Rubén apenas apunta sus pasos: el panel lo avisa');
  check(!panel.find((r) => r.nombre === 'Ana López').alertas.some((a) => a.tipo === 'habitos'), 'Ana los lleva bien: sin aviso');
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const anaV = await api.miAtleta();
  const rh = await api.resumenHabitos(anaV.id);
  check(rh.length === 4 && rh.find((r) => r.habito.nombre === 'Pasos').hoy === 5400, 'Ana tiene 4 hábitos y hoy lleva 5.400 pasos');
  const pv = await api.programa(anaV.id);
  const sv = pv.sesiones[pv.actual.id];
  const toca = queToca(sv, pv.actual, hoyISO());
  check(toca.hoy && toca.hoy.nombre === 'Torso B', 'según su plan, hoy toca Torso B');
  const dTop = await api.sesion(toca.hoy.id, anaV.id);
  check(Number(dTop.ejercicios[0].backoff_pct) === 10 && dTop.ejercicios[0].series >= 2, 'y su primer ejercicio va con serie top y back-off al −10 %');
  check(await lanza(() => api.marcarSesion(toca.hoy.id, { dia_previsto: '2000-01-01' })), 'un día fuera de la semana: la demo lo rechaza, como Supabase');
  const mov = rh.find((r) => r.habito.tipo === 'si_no').habito;
  check(await lanza(() => api.apuntarHabito(mov.id, hoyISO(), 2)), 'en un hábito de sí/no, solo 0 o 1');
  check((await api.archivos(anaV.id, 'foto_progreso')).every((f) => f.pose === 'frente'), 'sus fotos de ejemplo son de frente');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  check(await lanza(() => api.actualizar('sesion_ejercicios', dTop.ejercicios[0].id, { backoff_pct: 60 })), 'un back-off de más del 50 %, rechazado');
  const pl = (await api.plantillas()).find((x) => x.nombre === 'Torso-pierna 3 días');
  const cp = await api.bloqueCompleto(pl.id);
  check(Object.values(cp.pautas).flat().some((x) => Number(x.backoff_pct) === 10), 'la plantilla de torso-pierna trae la sentadilla con top + back-off');
  // Las reglas nuevas de la revisión de la 008, también en la demo
  const pasosAna = (await api.habitos(anaV.id)).find((h) => h.nombre === 'Pasos');
  const otro = (await api.atletas()).find((a) => a.id !== anaV.id);
  check(await lanza(() => api.guardarHabito(anaV.id, { ...pasosAna, tipo: 'si_no' }, pasosAna.id)) && await lanza(() => api.actualizar('habitos', pasosAna.id, { atleta_id: otro.id })),
    'un hábito con días apuntados no cambia de tipo ni de atleta');
  const semanaOtra = (await b.select('semanas', { eq: { bloque_id: pv.actual.bloque_id } })).find((w) => w.id !== pv.actual.id);
  const diaAntes = toca.hoy.dia_previsto;
  const movida = (await b.update('sesiones', { semana_id: semanaOtra.id }, { eq: { id: toca.hoy.id } }))[0];
  check(movida.dia_previsto === null, 'si el coach pasa una sesión a otra semana, pierde el día previsto (en vez de fallar)');
  await b.update('sesiones', { semana_id: pv.actual.id, dia_previsto: diaAntes }, { eq: { id: toca.hoy.id } });
}

console.log('\nv0.11 en la demo');
{
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const anaN = await api.miAtleta();
  const rn = await api.resumenNutricion(anaN.id, hoyISO(), { entrenaHoy: true });
  check(rn.plan.modo === 'macros' && rn.plan.kcal_descanso != null && rn.planes.length === 2 && /Ajuste/.test(rn.plan.motivo), 'Ana tiene su plan de kcal y macros, con días de descanso, y un ajuste de hace dos semanas');
  check(rn.hoy && rn.hoy.kcal === 1120 && rn.objetivoHoy.kcal === rn.plan.kcal, 'hoy lleva desayuno y comida (y hoy entrena: objetivo de día de entreno)');
  check(rn.gasto.kcal > 1700 && rn.gasto.kcal < 2400 && rn.gasto.fiabilidad !== 'baja' && rn.ajuste, `su gasto estimado (${rn.gasto.kcal} ± ${rn.gasto.margen} kcal) y lo que toca para su ritmo`);
  check(await lanza(() => api.apuntarNutricion(anaN.id, hoyISO(), { kcal: 99999 })) && await lanza(() => api.apuntarNutricion(anaN.id, '2099-01-01', { kcal: 2000 })), 'la demo rechaza lo mismo que la base: cifras imposibles y días que no han llegado');
  await api.apuntarNutricion(anaN.id, hoyISO(), { kcal: 1900, proteina_g: 128, carbos_g: 222, grasa_g: 54 });
  check((await api.resumenNutricion(anaN.id, hoyISO(), { entrenaHoy: true })).semana.dias.find((d) => d.hoy).estado === 'si', 'al completar el día, queda «en objetivo»');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const ruben = (await api.atletas()).find((a) => a.nombre === 'Rubén Martín');
  const rr = await api.resumenNutricion(ruben.id);
  check(rr.plan.modo === 'sin_contar' && rr.plan.kcal === null && rr.plan.pautas, 'Rubén va «sin contar», con pautas');
  const panel = await api.resumenes();
  check(panel.find((r) => r.nombre === 'Rubén Martín').alertas.some((x) => x.tipo === 'nutricion_registro'), 'y apenas apunta: el panel lo avisa');
  check(await lanza(() => api.guardarPlanNutricion(ruben.id, { desde: hoyISO(), modo: 'macros', fase: 'perder', ritmo_pct: 0.5, kcal: 2000, proteina_g: 150, carbos_g: 200, grasa_g: 60 })), 'un plan para bajar con ritmo positivo, rechazado');
  check(await lanza(() => api.actualizar('planes_nutricion', rr.plan.id, { atleta_id: anaN.id })), 'un plan no se pasa a otro atleta');
  const v = await api.guardarPlanNutricion(ruben.id, { desde: hoyISO(), modo: 'kcal_proteina', fase: 'perder', ritmo_pct: -0.5, kcal: 2400, proteina_g: 160 });
  check(v.kcal === 2400 && (await api.planesNutricion(ruben.id)).length === 2, 'el coach le pasa a «kcal y proteína» desde hoy (nueva versión)');
  check(await lanza(() => api.guardarPlanNutricion(ruben.id, { desde: hoyISO(), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 900, proteina_g: 150, carbos_g: 200, grasa_g: 60 }))
    && await lanza(() => api.guardarPlanNutricion(ruben.id, { desde: hoyISO(), modo: 'sin_contar', fase: 'mantener', ritmo_pct: -0.5 }))
    && await lanza(() => api.guardarPlanNutricion(ruben.id, { desde: hoyISO(), modo: 'sin_contar', fase: 'perder', pautas: '\u200b\u202e' })),
    'como la base: kcal que no cuadran con los macros, mantener con ritmo y pautas invisibles, rechazados');
  await b.auth.entrar('ana@fbe.demo', 'demo');
  check(await lanza(() => api.apuntarNutricion(anaN.id, hoyISO(), { kcal: 1900, proteina_g: 128.25 })) && await lanza(() => api.apuntarNutricion(anaN.id, hoyISO(), { kcal: 1900.5 })), 'y las cifras con más decimales de los que guarda la base');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
}

console.log('\nNotificaciones en la demo');
{
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const ult = await api.ultimasNotificaciones();
  check(ult.length === 3 && ult[0].titulo === 'Pelayo te ha respondido', 'Ana tiene tres notificaciones de ejemplo, la más reciente primero');
  const p = await api.preferenciasNotificaciones();
  const g = await api.guardarPreferenciasNotificaciones({ ...p, desactivados: ['nutricion'], hora_tarde: '20:00' });
  check(g.desactivados.join() === 'nutricion' && g.hora_tarde === '20:00' && (await api.preferenciasNotificaciones()).hora_tarde === '20:00', 'guarda sus preferencias');
  check(await lanza(() => api.guardarPreferenciasNotificaciones({ ...g, hora_tarde: '03:00' })) && await lanza(() => b.upsert('preferencias_notificaciones', { usuario_id: api.uid(), desactivados: ['spam'], hora_manana: '08:30', hora_tarde: '21:00', dia_checkin: 7, silencio_desde: null, silencio_hasta: null, email: false }, 'usuario_id')),
    'y rechaza lo mismo que la base (horas fuera de rango, tipos inventados)');
  check((await api.probarNotificacion()) === 'sin_canal' && await lanza(() => api.registrarSuscripcion({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'B', auth: 'A' })),
    'en la demo no hay móviles a los que enviar (y se dice)');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const pc = await api.preferenciasNotificaciones();
  check(pc.desactivados.join() === 'sesion_hecha' && (await api.ultimasNotificaciones()).length === 3, 'el coach tiene las suyas: de entrada, sin las sesiones terminadas');
  await b.auth.entrar('ana@fbe.demo', 'demo');
  await api.guardarPreferenciasNotificaciones(p);
}

console.log('\nv0.13 en la demo: cuestionario y check-in a medida');
{
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const rs = await api.resumenes();
  const rub = rs.find((r) => r.nombre === 'Rubén Martín');
  const anaR = rs.find((r) => r.nombre === 'Ana López');
  check(rub.alertas.some((a) => a.tipo === 'cuestionario' && a.nivel === 'info') && !anaR.alertas.some((a) => a.tipo === 'cuestionario'),
    'el panel avisa de que Rubén ha contado algo de salud por revisar (la medicación); lo de Ana ya está revisado');
  const cuR = await api.cuestionario(rub.atleta_id);
  check(cuR.resultado === 'sin_valoracion' && cuR.otras.join() === 'medicacion' && cuR.lesiones[0].zona === 'zona_lumbar', 'su cuestionario: sin valoración médica previa, con medicación y la lumbar');
  await api.revisarCuestionario(cuR.id);
  check(!(await api.resumenes()).find((r) => r.nombre === 'Rubén Martín').alertas.some((a) => a.tipo === 'cuestionario'), 'al revisarlo, el aviso se va');
  const pregR = await api.preguntasCheckin(rub.atleta_id);
  const atlR = (await api.atletas()).find((a) => a.id === rub.atleta_id);
  check(pregR.length === 3 && pregR[0].atleta_id === null && atlR.checkin_apartados.join() === 'peso,descanso,molestias,alimentacion', 'Rubén tiene la pregunta de todos y dos suyas, y no le pregunta ni medidas ni reloj');
  const ckR = (await api.ficha(rub.atleta_id)).checkins.find((c) => c.respuestas);
  check(Object.keys(ckR.respuestas).length >= 2, 'sus check-ins traen sus respuestas');
  check(await lanza(() => b.delete('preguntas_checkin', { eq: { id: pregR[1].id } })) && (await api.quitarPregunta(pregR[1].id)).archivado,
    'como la base: una pregunta con respuestas no se borra, se archiva');
  await api.recuperarPregunta(pregR[1].id);
  const carlos = rs.find((r) => r.nombre === 'Carlos Vera');
  check((await api.cuestionario(carlos.atleta_id)) === null, 'Carlos aún no tiene cuestionario');
  await api.pedirCuestionario(carlos.atleta_id);
  check(!!(await api.cuestionario(carlos.atleta_id)).pedido_en, 'y el coach se lo pide');
  await b.upsert('cuestionarios', [{ atleta_id: carlos.atleta_id, pedido_en: '2000-01-01T00:00:00.000Z' }], 'atleta_id');
  check((await api.cuestionario(carlos.atleta_id)).pedido_en > '2026', 'con la hora de la base, no la del móvil');
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const anaA = await api.miAtleta();
  const cuA = await api.cuestionario(anaA.id);
  check(cuA.completado_en && cuA.resultado === 'sin_valoracion' && (await api.primerosPasos(anaA.id)).cuestionario, 'Ana tiene el suyo hecho');
  check(await lanza(() => api.guardarCuestionario(anaA.id, { lesiones: [{ zona: 'oreja', limita: 1 }] })) && await lanza(() => api.guardarCuestionario(anaA.id, { dias_semana: 9 })),
    'y la demo rechaza lo mismo que la base');
  const cambio = await api.guardarCuestionario(anaA.id, { enfermedad: true, enfermedad_detalle: 'Asma' }, { completar: true });
  check(cambio.resultado === 'valorar_antes_vigoroso' && cambio.revisado_en === null && cambio.completado_en > cuA.completado_en, 'si lo actualiza, se recalcula y vuelve a estar por revisar');
  const pregA = await api.preguntasCheckin(anaA.id);
  check(pregA.length === 1 && pregA[0].tipo === 'escala', 'a Ana solo le llega la pregunta para todos');
  const lunesA = lunesDe(hoyISO());
  check(await lanza(() => api.guardarCheckin(anaA.id, lunesA, { energia: 3, respuestas: { [pregA[0].id]: 7 } }))
    && await lanza(() => api.guardarCheckin(anaA.id, lunesA, { energia: 3, respuestas: { [pregR[1].id]: 7 } })), 'no acepta una respuesta fuera de escala ni a una pregunta de otro');
  await api.guardarCheckin(anaA.id, lunesA, { energia: 3, respuestas: { [pregA[0].id]: 2 } });
  check((await api.checkin(anaA.id, lunesA)).checkin.respuestas[pregA[0].id] === 2, 'responde en su check-in');
  await api.guardarCuestionario(anaA.id, { enfermedad: false, enfermedad_detalle: null }, { completar: true });
}

console.log('\nVerificación en dos pasos en la demo');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const f = await b.auth.mfa.inscribir('Móvil');
await b.auth.mfa.verificar(f.id, '123456');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.atletas()).length === 0 && (await b.auth.mfa.nivel()).siguiente === 'aal2', 'sin el segundo paso, el coach no ve datos');
await b.auth.mfa.verificar(f.id, '123456');
check((await api.atletas()).length === 7, 'con el código 123456, sí');
await b.auth.mfa.quitar(f.id);
await b.auth.entrar('ana@fbe.demo', 'demo');

console.log('\nFoto de perfil en la demo (v0.19)');
{
  const jpg = 'data:image/jpeg;base64,' + '/9j/'.repeat(50);
  const p = await api.cambiarFoto(jpg);
  check(p.foto === jpg && await lanza(() => b.update('perfiles', { foto: 'data:image/png;base64,AAAA' }, { eq: { id: p.id } })), 'la demo guarda la foto y rechaza lo mismo que la base');
  check((await api.atletas()).some((a) => a.foto === jpg) || (await api.perfil()).foto === jpg, 'y la foto sale donde toca');
  await api.cambiarFoto(null);
}

console.log('\nActivación con código en la demo');
await b.auth.salir();
await b.auth.registrar('marta@correo.test', 'una-contraseña-larga', 'Marta');
check((await api.canjearCodigo('fbe marta 7k3pq')) !== null, 'Marta canjea su código');
check((await api.miAtleta()).nombre === 'Marta Gil', 'queda vinculada a su ficha');

// v0.25: cómo va con sus pagos (Carlos, retrasado; el coach no tiene)
await b.auth.entrar('carlos@fbe.demo', 'demo');
const cobroCarlos = await api.miCobro();
check(cobroCarlos?.estado === 'retrasado' && cobroCarlos.debe === 190, 'en la demo, Carlos ve que tiene un pago retrasado (190 €), como en la base');
check((await api.cobrosAtleta((await api.miAtleta()).id)).pagos.length === 0, 'y no ve la lista de sus cobros');

// v0.26: la demo aplica las reglas de la 022
await b.auth.entrar('lucia@fbe.demo', 'demo');
const luciaD = await api.miAtleta();
check(await lanza(() => api.guardarReceta({ nombre: 'Mía', tomas: ['cena'] })), 'en la demo, Lucía no puede crear recetas, como en la base');
const recL = await api.recetario(luciaD.id);
check(recL.asignaciones.length > 5 && await lanza(() => api.cambiarAsignacion(recL.asignaciones[0].id, { factor: 3 })), 've su recetario, pero no se cambia el factor');
const lunesL = lunesDe(hoyISO());
const antesL = (await api.menuSemana(luciaD.id, sumarDias(lunesDe(hoyISO()), 7))).length;
await api.copiarMenuSemana(luciaD.id, lunesL, sumarDias(lunesDe(hoyISO()), 7));
const trasUna = (await api.menuSemana(luciaD.id, sumarDias(lunesDe(hoyISO()), 7))).length;
await api.copiarMenuSemana(luciaD.id, lunesL, sumarDias(lunesDe(hoyISO()), 7));
check(trasUna > antesL && (await api.menuSemana(luciaD.id, sumarDias(lunesDe(hoyISO()), 7))).length === trasUna, 'copiar su semana dos veces no duplica');
const recLD = await api.recetario(luciaD.id);
check(recLD.opcional === 'merienda' && recLD.asignaciones.filter((a) => a.variante === 'sin').length === 3 && (await api.diasSin(luciaD.id, lunesL)).includes(sumarDias(lunesL, 6)),
  'Lucía no merienda algunos días: la demo trae sus recetas para esos días y el domingo marcado');
await api.guardarComidas(luciaD.id, recLD.tomas, null);
check((await api.recetario(luciaD.id)).opcional === 'merienda' && await lanza(() => api.cambiarAsignacion(recLD.asignaciones.find((a) => a.variante).id, { variante: null })), 'y, como en la base, no cambia cuál es la opcional ni para qué días es cada receta');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
const marta = (await api.atletas()).find((a) => a.nombre === 'Marta Gil');
check(await lanza(() => api.apuntarMenu(marta.id, { fecha: hoyISO(), toma: 'comida', texto: 'Algo' })), 'sin su consentimiento de salud, ni el coach le apunta el menú (como en la base)');

console.log('\nLa comunidad del equipo en la demo (v0.43)');
{
  await b.auth.entrar('ana@fbe.demo', 'demo');
  const anaC = await api.miAtleta();
  check((await api.comunidad()).activa && (await api.miembroComunidad()) === null, 'la comunidad está abierta y Ana aún no ha entrado (la demo enseña la entrada)');
  check((await api.muro()).posts.length === 0 && Object.keys(await api.personasComunidad()).length === 0 && (await api.rankingComunidad()).length === 0, 'sin entrar, no ve nada (como en la base)');
  check(await lanza(() => b.rpc('comunidad_unirme', { p_nombre: 'Ana L.', p_version: 'comunidad-2026-11' })), 'como en la base, sin las normas no se entra (v0.44)');
  await api.entrarComunidad('Ana L.');
  check((await api.miembroComunidad()).normas_version === 'normas-2026-11', 'Ana entra con las normas leídas');
  const muro = await api.muro();
  check(muro.posts[0].tipo === 'aviso' && muro.posts[0].fijada && muro.posts[0].autor.coach, 'dentro: arriba, el aviso fijado del coach');
  check(Object.keys(await api.personasComunidad()).length === 5, 'los de la demo ya tienen leídas las normas vigentes: los ve a todos (con el coach)');
  const entrenoR = muro.posts.find((x) => x.tipo === 'entreno' && x.autor.nombre === 'Rubén M.');
  check(entrenoR?.autor.nombre === 'Rubén M.' && entrenoR.resumen.ejercicios.length >= 3 && entrenoR.comentarios === 2 && Object.values(entrenoR.reacciones).flat().length === 3, 'el entreno compartido de Rubén, con reacciones y comentarios');
  check(muro.posts.length === 9 && muro.posts.some((x) => x.tipo === 'encuesta') && muro.posts.some((x) => x.tipo === 'logro'), 'y las publicaciones de Carlos, Lucía y Rubén, la encuesta del coach y el logro de Carlos (v0.47; v0.71: un truco de técnica y una pregunta al coach)');
  // v0.51: Carlos ha compartido hoy su último entreno (su foto lleva el aro): sale de lo que ya se ve en el muro
  const entrenoC = muro.posts.find((x) => x.tipo === 'entreno' && x.autor.nombre === 'Carlos V.');
  const hoyEq = await api.compartieronHoyComunidad();
  const carlosP = muro.posts.find((x) => x.autor.nombre === 'Carlos V.')?.autor_id;
  check(!!entrenoC && entrenoC.resumen.con_kilos === false && hoyEq instanceof Set && hoyEq.has(carlosP) && hoyEq.size === 1, 'Carlos ha compartido hoy su último entreno (sin kilos): es el único con el aro de «hoy»');
  const retos = await api.retosComunidad();
  const reto8 = retos.find((r) => r.titulo === 'Reto de constancia: 8 sesiones');
  check(retos.length === 6 && reto8?.progreso.length === 4 && reto8.progreso.some((x) => x.yo && x.nombre === 'Ana L.'), `un reto con el progreso de los cuatro (${reto8?.progreso.map((x) => `${x.nombre} ${x.hechas}`).join(', ')})`);
  check((await api.logrosComunidad()).length === 0, 'Ana acaba de entrar: los retos que acabaron antes no los celebra');
  const rk = await api.rankingComunidad();
  check(rk.some((x) => x.nombre === 'Rubén M.' && x.previstas >= 3) && rk.some((x) => x.yo) && !rk.some((x) => x.nombre === 'Lucía F.'), `el ranking de la semana (sin Lucía, que solo lleva nutrición): ${rk.map((x) => `${x.nombre} ${x.hechas}/${x.previstas}`).join(', ')}`);
  const pA = await api.publicarEnComunidad({ texto: '¡Hola, equipo!' });
  check(pA.autor_id && pA.tipo === 'post' && pA.fijada === false, 'publica a su nombre');
  check(await lanza(() => b.insert('comunidad_posts', [{ tipo: 'aviso', texto: 'Soy coach' }])) && await lanza(() => b.insert('comunidad_reacciones', [{ post_id: pA.id, autor_id: 'x', tipo: 'fuego' }])),
    'como en la base: ni avisos del coach ni reacciones a mano');
  check((await api.reaccionar(entrenoR.id, 'fuerza')) === 'fuerza' && (await api.reaccionar(entrenoR.id, 'fuerza')) === null, 'reacciona y, al tocar otra vez, la quita');
  await api.comentarEnComunidad(entrenoR.id, '¡Enhorabuena, Rubén!');
  const hechas = Object.values((await api.programa(anaC.id)).sesiones).flat().filter((x) => x.completada);
  const idSin = await api.compartirEnEquipo(hechas[0].id, { kilos: false });
  const idCon = await api.compartirEnEquipo(hechas[1].id, { kilos: true, records: [] });
  const m2 = await api.muro();
  const sin = m2.posts.find((x) => x.id === idSin), con = m2.posts.find((x) => x.id === idCon);
  check(!JSON.stringify(sin.resumen).includes('"kg"') && con.resumen.con_kilos && con.resumen.ejercicios.some((x) => x.kg > 0 && x.reps > 0), 'comparte un entreno sin los kilos y otro con ellos (la tarjeta, de lo registrado)');
  check(await lanza(() => api.compartirEnEquipo(hechas[0].id)), 'una sesión, una vez');
  await api.avisarAlCoach({ postId: m2.posts.find((x) => x.autor.nombre === 'Carlos V.').id, motivo: 'Prueba' });
  await b.auth.entrar('ruben@fbe.demo', 'demo');
  check((await api.muro()).posts.some((x) => x.id === pA.id), 'Rubén ve lo de Ana');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  const band = await api.bandeja();
  check(band.comunidad.length === 1 && band.comunidad[0].quienAvisa === 'Ana L.', 'el coach ve el aviso en Revisar');
  const avisado = band.comunidad[0].post.id;
  await api.ocultarEnComunidad(band.comunidad[0].post.id, true);
  await api.resolverReporte(band.comunidad[0].id);
  check((await api.bandeja()).comunidad.length === 0 && (await api.muro()).posts.some((x) => x.oculta), 'lo oculta (él lo sigue viendo, marcado) y queda resuelto');
  await b.auth.entrar('ruben@fbe.demo', 'demo');
  check(!(await api.muro()).posts.some((x) => x.oculta || x.id === avisado), 'los atletas ya no lo ven');
  await b.auth.entrar('ana@fbe.demo', 'demo');
  await api.ajustesComunidad({ sinRanking: true });
  await api.salirComunidad();
  await b.auth.entrar('ruben@fbe.demo', 'demo');
  check(!(await api.muro()).posts.some((x) => x.id === pA.id || x.id === idSin) && !(await api.rankingComunidad()).some((x) => x.nombre === 'Ana L.'), 'si Ana sale, para Rubén desaparece todo lo suyo');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.actualizarAtleta((await api.atletas()).find((a) => a.nombre === 'Rubén Martín').id, { estado: 'baja' });
  await b.auth.entrar('ruben@fbe.demo', 'demo');
  check((await api.muro()).posts.length === 0 && await lanza(() => api.publicarEnComunidad({ texto: 'De baja' })), 'de baja, fuera al momento');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.actualizarAtleta((await api.atletas()).find((a) => a.nombre === 'Rubén Martín').id, { estado: 'activo' });
  // Como la base tras la revisión: sacar y readmitir, nombres, y nada de cambiar publicaciones a mano
  const carlosA = (await api.atletas()).find((x) => x.nombre === 'Carlos Vera');
  await api.expulsarDeComunidad(carlosA.id, true);
  await b.auth.entrar('carlos@fbe.demo', 'demo');
  check((await api.miembroComunidad()).bloqueado && await lanza(() => api.entrarComunidad('Carlos V.')), 'el coach saca a Carlos y no puede volver a entrar');
  await b.auth.entrar('lucia@fbe.demo', 'demo');
  check(await lanza(() => api.ajustesComunidad({ nombre: 'Pelayo' })) && await lanza(() => api.ajustesComunidad({ nombre: 'rubén m.' })) && await lanza(() => b.update('comunidad_posts', { texto: 'x' }, { eq: {} })),
    'ni el nombre del coach ni uno repetido, y las publicaciones no se cambian a mano');
  await b.auth.entrar('pelayo@fbe.demo', 'demo');
  await api.expulsarDeComunidad(carlosA.id, false);
  await api.abrirComunidad(false);
  await b.auth.entrar('lucia@fbe.demo', 'demo');
  check((await api.muro()).posts.length === 0, 'cerrada, nadie ve el muro');
}

console.log('\nLas mejoras de la comunidad en la demo (v0.47, como la 029)');
{
  // Una demo recién empezada
  const b2 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a2 = crearApi(b2);
  const { VERSION_COMUNIDAD } = await import('../web/src/datos/api.js');
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  const coachId = a2.uid();
  const miembros = await a2.miembrosComunidad();
  check(miembros.length === 3 && miembros.every((m) => m.version === VERSION_COMUNIDAD) && VERSION_COMUNIDAD === 'comunidad-2026-11-b', 'los de la demo ya han aceptado el texto nuevo (comunidad-2026-11-b)');
  const pid = Object.fromEntries(miembros.map((m) => [m.nombre, m.perfil_id]));
  const retosC = await a2.retosComunidad();
  check(retosC.length === 6 && retosC.some((r) => r.modo === 'equipo' && r.total > 0 && r.total < r.objetivo), `los retos de la demo, uno de equipo en marcha (${retosC.map((r) => `${r.titulo} ${r.modo}`).join(' · ')})`);
  check(await lanza(() => a2.guardarReto({ titulo: 'Mucho', desde: hoyISO(), hasta: sumarDias(hoyISO(), 7), objetivo: 101 }))
    && !!(await a2.guardarReto({ titulo: 'Mucho equipo', desde: hoyISO(), hasta: sumarDias(hoyISO(), 7), objetivo: 101, modo: 'equipo' })), 'como en la base: individual hasta 100, de equipo hasta 5000');
  check(await lanza(() => a2.publicarEnComunidad({ encuesta: { pregunta: '¿Una?', opciones: ['Sola'] } })) && await lanza(() => b2.insert('comunidad_posts', [{ tipo: 'encuesta', texto: '¿Iguales?', encuesta: { opciones: ['Sí', 'sí'] } }])),
    'una encuesta, con 2 a 4 opciones distintas (también a mano)');
  const resumenC = await a2.resumenSemanaComunidad();
  check(resumenC && resumenC.miembros === 3 && resumenC.retos >= 2, `el coach ve el resumen de la semana (${JSON.stringify(resumenC)})`);

  // Rubén: su racha, sus ánimos y el logro que celebra al entrar
  await b2.auth.entrar('ruben@fbe.demo', 'demo');
  const rachas = await a2.rachasComunidad();
  check(rachas[pid['Rubén M.']]?.racha >= 1 && rachas[pid['Rubén M.']].yo, `la racha de Rubén (${rachas[pid['Rubén M.']]?.racha})`);
  check((await a2.animosComunidad()).recibidos.map((x) => x.nombre).sort().join() === 'Carlos V.,Pelayo', 'a Rubén le han animado Carlos y el coach esta semana');
  const logros = await a2.logrosComunidad();
  check(logros.length === 1 && logros[0].titulo === 'Semana de arranque: 3 sesiones', 'Rubén tiene un logro por celebrar (y el que acabó antes de entrar no cuenta)');
  const idL = await a2.compartirLogro(logros[0].id, '¡A por la siguiente!');
  check(!!idL && await lanza(() => a2.compartirLogro(logros[0].id)) && (await a2.logrosComunidad()).length === 0, 'lo comparte una vez (y ya no se celebra)');
  const otro = retosC.find((r) => r.titulo.startsWith('Reto de constancia'));
  check(await lanza(() => a2.compartirLogro(otro.id)), 'uno sin conseguir, no');
  const muroL = await a2.muro({ filtro: 'logros' });
  check(muroL.posts.length === 2 && muroL.posts.every((x) => x.tipo === 'logro') && muroL.posts.some((x) => x.id === idL && x.resumen.hechas >= 3), '«Logros»: el suyo y el de Carlos');
  check((await a2.muro({ filtro: 'avisos' })).posts.every((x) => ['aviso', 'encuesta'].includes(x.tipo)) && (await a2.muro({ filtro: 'mio' })).posts.every((x) => x.mio), 'y los demás filtros');
  // La encuesta
  const enc = (await a2.muro()).posts.find((x) => x.tipo === 'encuesta');
  check(enc?.resultados.total === 3 && enc.resultados.miVoto === 0 && enc.resultados.quien[0].length === 2, 'la encuesta del coach, con sus votos (Rubén ya votó)');
  check((await a2.votarEncuesta(enc.id, 2)) === 2 && await lanza(() => a2.votarEncuesta(enc.id, 3)) && await lanza(() => b2.insert('comunidad_votos', [{ post_id: enc.id, autor_id: a2.uid(), opcion: 1 }])),
    'cambia su voto; una opción que no existe o un voto a mano, no');
  check((await a2.muro()).posts.find((x) => x.id === enc.id).resultados.conteos.join() === '1,1,1', 'los resultados se ponen al día');
  // Menciones
  const pM = await a2.publicarEnComunidad({ texto: '@Lucía F. ¡bien!', menciones: [pid['Lucía F.'], pid['Rubén M.'], 'x-de-fuera', pid['Lucía F.']] });
  check(pM.menciones.join() === pid['Lucía F.'], 'de las menciones queda solo quien está dentro (ni él mismo, ni repetidas)');
  const pLucia = (await a2.muro()).posts.find((x) => x.autor.nombre === 'Lucía F.' && x.tipo === 'post');
  check((await a2.comentariosComunidad(pLucia.id)).some((c) => c.mencionados.some((m) => m.nombre === 'Lucía F.')), 'la mención de Carlos a Lucía, en su comentario');
  // Perfil y ánimos
  const pfC = await a2.perfilComunidad(pid['Carlos V.']);
  check(pfC.retos === 1 && pfC.retos_titulos[0].startsWith('Tres semanas') && pfC.posts.length >= 2 && !pfC.animado, 'el perfil de Carlos: su reto conseguido y sus publicaciones');
  await a2.animar(pid['Carlos V.']);
  check((await a2.perfilComunidad(pid['Carlos V.'])).animado && await lanza(() => a2.animar(pid['Carlos V.'])) && await lanza(() => a2.animar(a2.uid())) && await lanza(() => b2.insert('comunidad_animos', [{ de: a2.uid(), para: pid['Lucía F.'], semana: lunesDe(hoyISO()) }])),
    'anima a Carlos una vez por semana (a sí mismo o a mano, no)');
  // «No salir en el ranking»: tampoco racha ni retos en el perfil, ni suma en el reto de equipo
  const eqAntes = (await a2.retosComunidad()).find((r) => r.modo === 'equipo').total;
  await b2.auth.entrar('carlos@fbe.demo', 'demo');
  await a2.ajustesComunidad({ sinRanking: true });
  check((await a2.perfilComunidad(a2.uid())).retos === 1, 'Carlos sigue viendo su perfil completo (su reto conseguido)');
  await b2.auth.entrar('ruben@fbe.demo', 'demo');
  const pfC2 = await a2.perfilComunidad(pid['Carlos V.']);
  check(pfC2.racha === null && pfC2.retos === null && !(pid['Carlos V.'] in (await a2.rachasComunidad())), 'sin ranking, Rubén no ve la racha ni los retos de Carlos');
  check((await a2.retosComunidad()).find((r) => r.modo === 'equipo').total <= eqAntes && (await a2.resumenSemanaComunidad()).miembros === 2, 'ni cuenta en el reto de equipo ni en el resumen de la semana');
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await a2.perfilComunidad(pid['Carlos V.'])).retos === 1, 'el coach sí');
  check(await lanza(() => a2.votarEncuesta(enc.id, 0)), 'el coach no vota');
  await a2.animar(pid['Lucía F.']);
  // Salir: votos y ánimos, como las reacciones
  await b2.auth.entrar('ruben@fbe.demo', 'demo');
  await a2.salirComunidad();
  const mios = await a2.exportar((await a2.miAtleta()).id);
  check(mios.comunidad.votos.length === 1 && mios.comunidad.animos_mandados.some((x) => x.para === pid['Carlos V.']), '«Descargar mis datos» lleva sus votos y sus ánimos');
  await b2.auth.entrar('lucia@fbe.demo', 'demo');
  check((await a2.muro()).posts.find((x) => x.id === enc.id).resultados.total === 2, 'si Rubén sale, su voto deja de contar');
  await b2.auth.entrar('ruben@fbe.demo', 'demo');
  await a2.entrarComunidad('Rubén M.');
  await a2.salirComunidad({ borrar: true });
  await b2.auth.entrar('pelayo@fbe.demo', 'demo');
  const copia = await a2.copiaCompleta();
  check(!copia.comunidad_votos.some((v) => v.autor_id === pid['Rubén M.']) && !copia.comunidad_animos.some((x) => x.de === pid['Rubén M.'] || x.para === pid['Rubén M.']),
    'saliendo con «borrar», se borran sus votos y sus ánimos (mandados y recibidos)');
  void coachId;
}

console.log('\nLo que encontró la revisión de seguridad de la 029, en la demo');
{
  const b3 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a3 = crearApi(b3);
  const { fechaMadrid } = await import('../web/src/logica/fechas.js');
  const hoyM = fechaMadrid();
  await b3.auth.entrar('pelayo@fbe.demo', 'demo');
  const pid = Object.fromEntries((await a3.miembrosComunidad()).map((m) => [m.nombre, m.perfil_id]));
  const atl = Object.fromEntries((await a3.atletas()).map((a) => [a.nombre, a]));
  const rHoy = await a3.guardarReto({ titulo: 'Hoy tres', desde: hoyM, hasta: hoyM, objetivo: 3 });
  // M1: fechas imposibles y sesiones marcadas de golpe
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  const hechasAntes = Object.values((await a3.programa(atl['Rubén Martín'].id)).sesiones).flat().filter((x) => x.completada && x.fecha_realizada < sumarDias(hoyM, -3)).slice(0, 3);
  let msg = '';
  try { await a3.actualizar('sesiones', hechasAntes[0].id, { fecha_realizada: '2099-01-01' }); } catch (e) { msg = e.message; }
  check(/no puede ser posterior a hoy/.test(msg), 'como en la base: el atleta no fecha una sesión después de mañana');
  for (const x of hechasAntes) await a3.actualizar('sesiones', x.id, { fecha_realizada: hoyM });
  const hoyTres = (await a3.retosComunidad()).find((r) => r.id === rHoy.id);
  const yoHoy = hoyTres.progreso.find((x) => x.yo).hechas;
  check(yoHoy === 2 && !hoyTres.conseguido, `tres sesiones fechadas hoy cuentan dos (${yoHoy})`);
  await b3.auth.entrar('pelayo@fbe.demo', 'demo');
  // (con quien más sesiones tiene en el reto del equipo: así vale cualquier día de la semana; antes era Carlos, que
  // solo tenía una dentro los domingos. Su bloque vuelve después, para lo que sigue)
  const equipoAntes = (await a3.retosComunidad()).find((r) => r.modo === 'equipo');
  const quien = [...equipoAntes.progreso].sort((x, y) => y.hechas - x.hechas)[0];
  const atletaQuien = Object.values(atl).find((a) => a.perfil_id === quien.perfil_id);
  const bloquesQuien = (await b3.select('bloques', { eq: { atleta_id: atletaQuien.id, es_plantilla: false } })).filter((x) => x.estado !== 'cancelado');
  for (const x of bloquesQuien) await a3.actualizar('bloques', x.id, { estado: 'cancelado' });
  const totalCancelado = (await a3.retosComunidad()).find((r) => r.modo === 'equipo').total;
  check(quien.hechas > 0 && totalCancelado === equipoAntes.total - quien.hechas, `las sesiones de un bloque cancelado no cuentan (${quien.nombre}: ${equipoAntes.total} → ${totalCancelado})`);
  for (const x of bloquesQuien) await a3.actualizar('bloques', x.id, { estado: x.estado });
  check((await a3.retosComunidad()).find((r) => r.modo === 'equipo').total === equipoAntes.total, 'y vuelven a contar si el bloque deja de estar cancelado');
  // L4: rachas solo desde 1; L6: el coach no anima con la comunidad cerrada
  check(Object.values(await a3.rachasComunidad()).every((x) => x.racha >= 1) && !(pid['Lucía F.'] in (await a3.rachasComunidad())), 'las rachas, solo desde 1 (Lucía, sin racha, no sale)');
  await a3.abrirComunidad(false);
  check(await lanza(() => a3.animar(pid['Lucía F.'])), 'con la comunidad cerrada, el coach no anima');
  await a3.abrirComunidad(true);
  // L6: votar, como mucho 30 veces al día
  const enc = (await a3.muro()).posts.find((x) => x.tipo === 'encuesta');
  await b3.auth.entrar('lucia@fbe.demo', 'demo');
  let tope = 0;
  for (let i = 0; i < 32; i++) { try { await a3.votarEncuesta(enc.id, (i + 1) % 3); tope++; } catch { break; } }
  check(tope === 30 && (await a3.votarEncuesta(enc.id, tope % 3)) === tope % 3, `votar o cambiar el voto, 30 veces al día (repetir el mismo no cuenta): ${tope}`);
  // L6: los logros, desde la última vez que entró
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  check((await a3.logrosComunidad()).some((r) => r.titulo.startsWith('Semana de arranque')), 'Rubén tiene su logro por celebrar');
  await a3.salirComunidad();
  await a3.entrarComunidad('Rubén M.');
  check(!(await a3.logrosComunidad()).some((r) => r.titulo.startsWith('Semana de arranque')), 'si sale y vuelve, el reto que acabó antes de volver ya no cuenta');
  // L3: salir y borrar se lleva los ánimos recibidos; «mis datos» no da el identificador de quien ya no está
  await b3.auth.entrar('lucia@fbe.demo', 'demo');
  await a3.salirComunidad({ borrar: true });
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  const mios = (await a3.exportar((await a3.miAtleta()).id)).comunidad;
  check(!mios.animos_mandados.some((x) => x.para === pid['Lucía F.']), 'Lucía sale y borra: también los ánimos que recibió');
  await a3.animar(pid['Rubén M.']).catch(() => {});
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  await a3.salirComunidad();
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  const mios2 = (await a3.exportar((await a3.miAtleta()).id)).comunidad;
  check(mios2.animos_mandados.some((x) => x.para_nombre === 'Alguien del equipo' && !('para' in x)) && mios2.comentarios.every((x) => typeof x.menciones === 'number'),
    '«mis datos»: a quien ya no está, «Alguien del equipo» (sin identificador); de sus menciones, cuántas');
}


console.log('\nv0.48 en la demo: tareas, programados, dónde entrenas, tu bloque, tu mes y el negocio');
{
  const { adaptarSesion, PERFILES_DEFECTO } = await import('../web/src/logica/material.js');
  const b4 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a4 = crearApi(b4);
  const hoy = hoyISO();
  await b4.auth.entrar('ana@fbe.demo', 'demo');
  const ana = await a4.miAtleta();
  const tareasAna = await a4.tareas(ana.id);
  check(tareasAna.length === 2 && tareasAna.some((t) => t.tipo === 'foto' && !t.hecha_en) && tareasAna.some((t) => t.tipo === 'texto' && t.hecha_en && t.respuesta), 'Ana tiene una tarea de fotos para hoy y otra ya contestada');
  const dia = await a4.tuDia(ana.id, { hoy });
  check(dia.some((x) => x.accion === 'tarea' && x.estado === 'toca' && x.icono === 'camara'), 'la de fotos le sale en «Tu día»');
  check(await lanza(() => b4.insert('tareas', [{ atleta_id: ana.id, tipo: 'texto', titulo: 'Me la pongo yo', fecha: hoy }])), 'no se pone tareas (como en la base)');
  const foto = tareasAna.find((t) => t.tipo === 'foto');
  check(await lanza(() => a4.completarTarea(foto.id)), 'la de fotos no se marca sin su foto');
  const [fotoAna] = await b4.select('archivos', { eq: { atleta_id: ana.id, tipo: 'foto_progreso' }, limit: 1 });
  check(!!fotoAna && !!(await a4.completarTarea(foto.id, { archivoId: fotoAna.id })), 'con una foto de progreso suya, sí');
  check((await a4.completarTarea(foto.id, { hecha: false })) === null, 'y lo puede deshacer');
  const det = await a4.sesion((await a4.programa(ana.id)).sesiones[(await a4.programa(ana.id)).actual.id].find((s) => !s.completada).id, ana.id);
  const dom = det.ejercicios.find((e) => e.ejercicio.nombre === 'Dominadas pronas');
  check(!!dom && det.coach[dom.ejercicio.id]?.lista[0]?.texto.includes('baja del todo'), '«Lo que te dijo tu coach» en las dominadas de su próxima sesión');
  const adap = adaptarSesion(det.ejercicios, PERFILES_DEFECTO.casa);
  check(Object.keys(adap.cambios).length >= 2 && adap.sinAlternativa.length >= 1, `en casa: ${Object.keys(adap.cambios).length} cambios por las alternativas del coach y ${adap.sinAlternativa.length} sin alternativa (se avisa)`);
  check(!(await a4.conversacion(ana.id)).some((c) => c.enviar_en) && !(await a4.noLeidos(ana.id)).some((c) => c.enviar_en), 'el mensaje programado para mañana no lo ve aún');
  check(!(await a4.avisos(ana.id, sumarDias(hoy, 8))).some((a) => a.enviar_en), 'ni el aviso programado para el lunes');
  const tb = await a4.tuBloque(ana.id);
  check(tb.semanas.some((w) => w.estado === 'actual') && tb.semanas.filter((w) => w.estado === 'por_publicar').length >= 1 && tb.semanas.filter((w) => w.estado === 'por_publicar').every((w) => !w.sesiones.length && !w.foco) && tb.principales.length >= 1,
    'su bloque entero: las semanas hechas, la actual y las por publicar (sin nada dentro), con los obligatorios');
  const mesPasado = (await import('../web/src/logica/mes.js')).mesAnterior();
  const rm = await a4.resumenMes(ana.id, mesPasado);
  check(!rm.vacio && rm.sesiones.hechas >= 4 && rm.records.length >= 1, `su mes pasado: ${rm.sesiones.hechas} sesiones de ${rm.sesiones.previstas} y ${rm.records.length} récords`);
  check(await lanza(() => b4.rpc('bloque_semanas', { p_bloque: crypto.randomUUID() }).then((r) => { if (r.length) throw new Error('ajeno'); })) === false, 'del bloque de otro, nada');
  check(await lanza(() => a4.enviarMensaje(ana.id, { texto: 'Programado', autor: 'atleta', enviarEn: new Date(Date.now() + 864e5).toISOString() })), 'el atleta no programa mensajes');

  await b4.auth.entrar('ruben@fbe.demo', 'demo');
  const ruben = await a4.miAtleta();
  const tr = await a4.tareas(ruben.id);
  const vid = tr.find((t) => t.tipo === 'video'), med = tr.find((t) => t.tipo === 'medida');
  check(vid && vid.fecha < hoy && !vid.hecha_en && (await a4.tuDia(ruben.id, { hoy })).find((x) => x.tareaId === vid.id)?.detalle.startsWith('Vídeo de técnica. Desde'), 'Rubén tiene un vídeo atrasado (sin agobiar: «Desde …»)');
  check(await lanza(() => a4.completarTarea(med.id)), 'la de medidas, para dentro de tres días, aún no');
  check(await lanza(() => a4.completarTarea(tareasAna[0].id)), 'ni marca las de Ana');

  await b4.auth.entrar('pelayo@fbe.demo', 'demo');
  const conv = await a4.conversacion(ana.id);
  check(conv.filter((c) => c.programado).length === 1 && (await a4.avisosCoach()).filter((a) => a.programado).length === 1, 'el coach ve el mensaje y el aviso programados');
  const band = await a4.bandeja();
  check(band.tareas.length === 1 && band.tareas[0].atleta.nombre.startsWith('Ana'), 'en Revisar, la tarea que contestó Ana');
  check((await a4.plantillasTareas()).length === 3, '3 plantillas de tareas');
  for (let i = 0; i < 27; i++) await a4.guardarPlantillaTarea({ tipo: 'texto', titulo: `P${i}` });
  check(await lanza(() => a4.guardarPlantillaTarea({ tipo: 'texto', titulo: 'La 31' })), 'como mucho 30 plantillas (como en la base)');
  const pn = await a4.panelNegocio();
  check(pn.activos === 5 && pn.meses.length === 12 && pn.bajas12 === 1 && pn.cobrado12 > 0 && pn.renovaciones.length >= 1, `el panel de negocio: ${pn.activos} activos, ${pn.bajas12} baja (Sergio) y ${pn.renovaciones.length} renovaciones en 30 días`);
  const carlos = (await a4.atletas()).find((a) => a.nombre === 'Carlos Vera');
  await a4.actualizar('atletas', carlos.id, { estado: 'baja' });
  check((await a4.atletas()).find((a) => a.id === carlos.id).baja_en === hoy, 'dar de baja apunta el día (como la base)');
  await a4.actualizar('atletas', carlos.id, { estado: 'activo' });
  check((await a4.atletas()).find((a) => a.id === carlos.id).baja_en === null, 'y volver de alta lo quita');
  const prog = conv.find((c) => c.programado);
  await a4.reprogramarMensaje(prog.id, { enviarEn: null });
  await b4.auth.entrar('ana@fbe.demo', 'demo');
  check((await a4.conversacion(ana.id)).some((c) => c.id === prog.id), '«Enviar ya»: Ana lo ve al momento');
  await b4.auth.entrar('pelayo@fbe.demo', 'demo');
  check(await lanza(() => a4.reprogramarMensaje(prog.id, { texto: 'Otra cosa' })), 'ya salido, no se cambia');
  const cks = await b4.select('checkins', { eq: { atleta_id: ana.id }, order: [['semana_inicio', 'asc']] });
  const cmp = await a4.compararCheckins(ana.id, cks.at(-1).id, cks[0].id);
  check(cmp.antes.checkin.id === cks[0].id && cmp.filas.some((f) => f.clave === 'peso' && f.dif != null), 'comparar el primer y el último check-in de Ana, con su peso');

  // Lo que encontró la revisión de seguridad de la v0.48, también en la demo
  const b5 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a5 = crearApi(b5);
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  const ana5 = (await a5.atletas()).find((x) => x.nombre === 'Ana López');
  const ruben5 = (await a5.atletas()).find((x) => x.nombre === 'Rubén Martín');
  const progAna = (await a5.conversacion(ana5.id)).find((c) => c.programado);
  const avisoProg = (await a5.avisosCoach()).find((x) => x.programado);
  const avisoYa = await a5.guardarAviso({ texto: 'Publicado ya' });
  check(await lanza(() => a5.guardarAviso({ texto: 'Publicado ya', enviarEn: new Date(Date.now() + 864e5).toISOString() }, avisoYa.id)), 'un aviso que ya ha salido no se puede volver a programar (como la base)');
  check(!!(await a5.guardarAviso({ texto: 'Más tarde', enviarEn: new Date(Date.now() + 2 * 864e5).toISOString() }, avisoProg.id)), 'uno que aún no ha salido, sí se cambia');
  const [ejPress] = await b5.select('ejercicios', { eq: { nombre: 'Press banca' } });
  const [ejRemo] = await b5.select('ejercicios', { eq: { nombre: 'Remo con barra' } });
  const tV = await a5.ponerTarea(ana5.id, { tipo: 'video', titulo: 'Vídeo del press', ejercicio_id: ejPress.id, fecha: hoy });
  const tV2 = await a5.ponerTarea(ana5.id, { tipo: 'video', titulo: 'Otro vídeo del press', ejercicio_id: ejPress.id, fecha: hoy });
  await b5.auth.entrar('ana@fbe.demo', 'demo');
  check((await b5.select('notificaciones', { eq: { usuario_id: (await a5.perfil()).id } })).every((x) => x.estado !== 'pendiente' || Date.parse(x.enviar_desde) <= Date.now())
    && !(await b5.select('notificaciones', {})).some((x) => x.clave === `comentario:${progAna.id}`), 'Ana no ve la notificación pendiente del mensaje programado (ni su hora ni su clave)');
  check((await b5.update('comentarios', { leido_en: new Date().toISOString() }, { eq: { id: progAna.id } })).length === 0, 'ni puede marcar leído un mensaje que aún no ha salido');
  check((await b5.select('comentarios', { eq: { atleta_id: ruben5.id } })).length === 0, 'ni ve los mensajes de Rubén');
  check((await b5.update('avisos', { texto: 'Cambiado por Ana' }, { eq: { id: avisoYa.id } })).length === 0
    && (await b5.update('atletas', { estado: 'baja', baja_en: hoy }, { eq: { id: ana5.id } })).length === 0 && (await a5.miAtleta()).estado === 'activo', 'no cambia avisos ni su ficha (ni su estado ni su baja)');
  const vRemo = await b5.insert('archivos', [{ atleta_id: ana5.id, tipo: 'video_tecnica', ruta: `${ana5.id}/remo.mp4`, ejercicio_id: ejRemo.id, fecha: hoy }]).then((r) => r[0]);
  const vPress = await b5.insert('archivos', [{ atleta_id: ana5.id, tipo: 'video_tecnica', ruta: `${ana5.id}/press.mp4`, ejercicio_id: ejPress.id, fecha: hoy }]).then((r) => r[0]);
  check(await lanza(() => a5.completarTarea(tV.id, { archivoId: vRemo.id })), 'la tarea de un vídeo del press no vale con un vídeo de remo');
  await a5.completarTarea(tV.id, { archivoId: vPress.id });
  check(await lanza(() => a5.completarTarea(tV2.id, { archivoId: vPress.id })), 'y un mismo vídeo no sirve para dos tareas');
  await b5.delete('archivos', { eq: { id: vPress.id } });
  check((await a5.tareas(ana5.id)).find((x) => x.id === tV.id).hecha_en === null, 'si borra el vídeo antes de que la revises, la tarea vuelve a pendiente');
}


// Los retos de la comunidad, con «hoy» fijado en cada día de una semana (de lunes a domingo) y en un cambio de mes:
// la demo no puede depender del día en que se pruebe (antes, un lunes, la sesión de hoy ya no sumaba y lo del bloque
// cancelado solo se veía los domingos). El reloj se cambia por uno fijo (a las 10:00 en Madrid) mientras se prueba.
console.log('\nRetos de la comunidad, cualquier día de la semana');
{
  const DateReal = Date;
  const conHoy = async (iso, fn) => {
    const t = new DateReal(`${iso}T10:00:00+01:00`).getTime();
    class DateFija extends DateReal { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }
    globalThis.Date = DateFija;
    try { return await fn(); } finally { globalThis.Date = DateReal; }
  };
  const dias = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-12-01'];
  const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (const dia of dias) {
    const r = await conHoy(dia, async () => {
      const { fechaMadrid } = await import('../web/src/logica/fechas.js');
      const hoyF = fechaMadrid();
      const b6 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
      const a6 = crearApi(b6);
      // La semilla: nadie con más de dos sesiones terminadas el mismo día (las que cuentan como mucho)
      const porDia = {};
      for (const x of (await b6.select('sesiones', {})).filter((y) => y.completada && y.fecha_realizada)) {
        const w = (await b6.select('semanas', { eq: { id: x.semana_id } }))[0];
        const bl = (await b6.select('bloques', { eq: { id: w.bloque_id } }))[0];
        const k = `${bl.atleta_id}-${x.fecha_realizada}`; porDia[k] = (porDia[k] || 0) + 1;
      }
      const maxDia = Math.max(...Object.values(porDia));
      // Rubén (como Ana en la prueba completa: dos hechas esta semana) termina hoy la que le queda: el reto suma una
      await b6.auth.entrar('ruben@fbe.demo', 'demo');
      const ruben6 = await a6.miAtleta();
      const reto = async () => (await a6.retosComunidad()).find((x) => x.titulo.startsWith('Reto de constancia')).progreso.find((x) => x.yo).hechas;
      const antes = await reto();
      const prog6 = await a6.programa(ruben6.id);
      const pendiente = (prog6.sesiones[prog6.actual.id] || []).find((x) => !x.completada);
      await a6.actualizar('sesiones', pendiente.id, { completada: true, fecha_realizada: hoyF, duracion_min: 50, rpe_sesion: 7 });
      const despues = await reto();
      // El coach cancela el bloque de quien más lleva en el reto del equipo: sus sesiones dejan de contar
      await b6.auth.entrar('pelayo@fbe.demo', 'demo');
      const equipo = (await a6.retosComunidad()).find((x) => x.modo === 'equipo');
      const quien = [...equipo.progreso].sort((x, y) => y.hechas - x.hechas)[0];
      const at = (await a6.atletas()).find((a) => a.perfil_id === quien.perfil_id);
      for (const x of await b6.select('bloques', { eq: { atleta_id: at.id, es_plantilla: false } })) await a6.actualizar('bloques', x.id, { estado: 'cancelado' });
      const total = (await a6.retosComunidad()).find((x) => x.modo === 'equipo').total;
      return { hoyF, semana: new DateReal(`${dia}T12:00:00`).getDay(), maxDia, antes, despues, quien: quien.hechas, totalAntes: equipo.total, total };
    });
    check(r.hoyF === dia && r.maxDia <= 2 && r.despues === r.antes + 1 && r.quien > 0 && r.total === r.totalAntes - r.quien,
      `${nombres[r.semana]} ${dia}: la sesión de hoy suma (${r.antes} → ${r.despues}), un bloque cancelado resta lo suyo (${r.totalAntes} → ${r.total}) y nadie pasa de 2 sesiones en un día (${r.maxDia})`);
  }
}

console.log('\nDías de entreno por semana en la demo (v0.53, como la 031)');
{
  const { racha } = await import('../web/src/logica/calculos.js');
  const { semanasObjetivo, paraRacha } = await import('../web/src/logica/semana-natural.js');
  const b6 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a6 = crearApi(b6);
  const hoy = hoyISO(), lunesH = lunesDe(hoy);
  const dia = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${lunesH}T12:00:00Z`)) / 864e5);
  const hechasHoy = [0, 2, 4].filter((o) => o < dia).length;  // lunes, miércoles y viernes, hasta ayer
  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  const rs = await a6.resumenes();
  const iv = rs.find((r) => r.nombre === 'Iván Prieto');
  check(!!iv && iv.diasSemana === 3 && iv.sesiones.total === 3 && iv.sesiones.completadas === hechasHoy, `en el panel, Iván (3 días por semana): ${iv?.sesiones.completadas}/3 esta semana, no de 4`);
  check(iv.chispas.sesiones.length === 6 && iv.chispas.sesiones.slice(0, 5).every((w) => w.total === 3) && iv.chispas.sesiones.slice(0, 5).map((w) => w.hechas).join() === '3,3,2,3,3',
    `su minigráfica, por semanas naturales con su objetivo (${iv.chispas.sesiones.map((w) => `${w.hechas}/${w.total}`).join(' ')})`);
  check(iv.cumplimiento?.sesiones.total === 12 && iv.cumplimiento.sesiones.hechas === 11 && iv.cumplimiento.series.pct >= 80 && !iv.alertas.some((a) => a.tipo === 'cumplimiento'),
    `su cumplimiento de 4 semanas: ${iv.cumplimiento?.sesiones.hechas} de 12 sesiones de su objetivo y el ${iv.cumplimiento?.series.pct} % de las series (sin aviso)`);
  const otros = rs.filter((r) => r.nombre !== 'Iván Prieto');
  check(otros.every((r) => r.diasSemana === null), 'el resto, sin objetivo (todo como antes)');
  const rub = otros.find((r) => r.nombre === 'Rubén Martín');
  const antesRuben = { panel: rub, constancia: await a6.constancia(rub.atleta_id), logros: await a6.logros(rub.atleta_id), semanas: await a6.resumenesSemanales(rub.atleta_id, 4) };

  await b6.auth.entrar('ivan@fbe.demo', 'demo');
  const ivan = await a6.miAtleta();
  const prog = await a6.programa(ivan.id);
  const pend = Object.values(prog.sesiones).flat().filter((x) => !x.completada);
  check(prog.diasSemana === 3 && (prog.sesiones[prog.actual.id] || []).some((x) => !x.completada) && prog.actual.numero < 6 && prog.actual.fecha_inicio < lunesH,
    `Hoy le enseña su microciclo (el ${prog.actual.numero}.º, con lo que le queda), no el de las fechas (el 6.º)`);
  const c = await a6.constancia(ivan.id);
  check(c.diasSemana === 3 && c.actual?.objetivo === 3 && c.actual.hechas === hechasHoy && c.semanas.every((w) => w.total === 3),
    `su constancia: ${c.actual?.hechas}/3 esta semana; cada semana natural, con objetivo 3`);
  check(c.racha === (hechasHoy === 3 ? 3 : 2) && c.semanasCompletas === (hechasHoy === 3 ? 5 : 4), `racha de ${c.racha} semanas completas seguidas (la de hace 3 se quedó en 2) y ${c.semanasCompletas} en total`);
  const sem = await a6.resumenesSemanales(ivan.id, 2);
  check(sem[0].sesiones.total === 3 && sem[0].sesiones.completa && sem[0].objetivoSemanal === 3, '«Tu semana»: la pasada, 3 de 3, completa');
  // (v0.93) los sábados y domingos su semana ya está completa (3 de 3) y la racha llega a 3, como en la constancia
  check((await a6.logros(ivan.id)).cuentas.racha === (hechasHoy === 3 ? 3 : 2), 'el logro «Semanas completas», con su objetivo (las seguidas como mucho)');
  check(await lanza(() => b6.update('atletas', { dias_semana: 7 }, { eq: { id: ivan.id } }).then((r) => { if (r.length) throw new Error('cambiado'); })) === false
    && (await a6.miAtleta()).dias_semana === 3, 'Iván no puede cambiarse el objetivo (como la base)');
  check(pend.length > 0, 'le quedan sesiones de su bloque');

  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  check(await lanza(() => a6.actualizarAtleta(rub.atleta_id, { dias_semana: 8 })) && await lanza(() => b6.update('atletas', { dias_semana: 0 }, { eq: { id: rub.atleta_id } })), 'fuera de 1 a 7, no (como la base)');
  await a6.actualizarAtleta(rub.atleta_id, { dias_semana: 3 });
  const rub3 = (await a6.resumenes(undefined, { soloAtleta: rub.atleta_id }))[0];
  const c3 = await a6.constancia(rub.atleta_id);
  check(rub3.diasSemana === 3 && c3.diasSemana === 3 && rub3.sesiones.total === c3.actual?.objetivo && c3.actual.objetivo <= 3 && c3.semanas.every((w) => w.total <= 3),
    `el coach le pone 3 a Rubén: su panel y su constancia pasan a su semana natural (esta semana, ${rub3.sesiones.completadas} de ${rub3.sesiones.total})`);
  await a6.actualizarAtleta(rub.atleta_id, { dias_semana: '' });
  const rubN = (await a6.resumenes(undefined, { soloAtleta: rub.atleta_id }))[0];
  check((await a6.atletas()).find((a) => a.id === rub.atleta_id).dias_semana === null && igualD(rubN.sesiones, antesRuben.panel.sesiones) && igualD(rubN.chispas, antesRuben.panel.chispas)
    && igualD(rubN.cumplimiento, antesRuben.panel.cumplimiento) && igualD(await a6.constancia(rub.atleta_id), antesRuben.constancia)
    && igualD(await a6.logros(rub.atleta_id), antesRuben.logros) && igualD(await a6.resumenesSemanales(rub.atleta_id, 4), antesRuben.semanas),
    'y al volver a «Automático», todo exactamente como antes (panel, constancia, logros y «Tu semana»)');
  // La lista de Rubén con «Automático», la de siempre
  const bl = (await b6.select('bloques', { eq: { atleta_id: rub.atleta_id, es_plantilla: false } }));
  const ws = await b6.select('semanas', { in: { bloque_id: bl.map((x) => x.id) }, eq: { programacion: 'programada' } });
  const ss = await b6.select('sesiones', { in: { semana_id: ws.map((w) => w.id) } });
  const viejo = ws.map((w) => ({ fecha_inicio: w.fecha_inicio, total: ss.filter((x) => x.semana_id === w.id).length, hechas: ss.filter((x) => x.semana_id === w.id && x.completada).length }));
  check(racha(viejo, hoy) === antesRuben.constancia.racha && racha(paraRacha(semanasObjetivo({ sesiones: ss, semanas: ws, hoy })), hoy) === antesRuben.constancia.racha, `la racha de Rubén, la misma que con la cuenta de antes (${antesRuben.constancia.racha})`);
  // Sin la 031 en la base, lo dice
  const sin031 = crearApi({ ...b6, auth: b6.auth, select: b6.select.bind(b6), update: async (t, c) => { if ('dias_semana' in c) throw new Error('Could not find the \'dias_semana\' column of \'atletas\' in the schema cache'); return b6.update(t, c); } });
  let msg = '';
  try { await sin031.actualizarAtleta(rub.atleta_id, { dias_semana: 3 }); } catch (e) { msg = e.message; }
  check(/migración 031/.test(msg), 'sin la migración 031, guardar los días por semana dice que falta');
}

console.log('\nEl chat como WhatsApp en la demo (v0.54): las mismas reglas que la 032');
{
  const b5 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a5 = crearApi(b5);
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  const atl = await a5.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre.startsWith('Rubén'));
  const hola = await a5.enviarMensaje(ana.id, { texto: 'Hola *Ana*', autor: 'coach' });
  const paraRuben = await a5.enviarMensaje(ruben.id, { texto: 'Rubén, descansa', autor: 'coach' });
  const prog = (await a5.conversacion(ana.id)).find((c) => c.programado);
  await b5.auth.entrar('ana@fbe.demo', 'demo');
  const r = await a5.enviarMensaje(ana.id, { texto: 'Hola', autor: 'atleta', respondeA: hola.id });
  check(r.responde_a === hola.id, 'Ana responde citando');
  check(await lanza(() => a5.enviarMensaje(ana.id, { texto: 'x', autor: 'atleta', respondeA: paraRuben.id })) && await lanza(() => a5.enviarMensaje(ana.id, { texto: 'x', autor: 'atleta', respondeA: prog.id })),
    'no cita lo de Rubén ni el programado (que aún no ve)');
  const sesMsg = (await a5.conversacion(ana.id)).find((c) => c.sesion_id);
  check(await lanza(() => a5.enviarMensaje(ana.id, { texto: 'x', autor: 'atleta', respondeA: sesMsg.id })), 'desde el chat no cita uno de una sesión (mismo hilo)');
  const rS = await a5.comentar({ atletaId: ana.id, sesionId: sesMsg.sesion_id, texto: 'En la sesión', autor: 'atleta', respondeA: sesMsg.id });
  check(rS.responde_a === sesMsg.id, 'en el hilo de la sesión, sí');
  check(await a5.reaccionarMensaje(hola.id, '👍') === '👍' && await a5.reaccionarMensaje(hola.id, '🙏') === '🙏' && await a5.reaccionarMensaje(hola.id, '🙏') === null, 'reaccionar, cambiar y quitar');
  check(await lanza(() => a5.reaccionarMensaje(paraRuben.id, '👍')) && await lanza(() => a5.reaccionarMensaje(prog.id, '👍')) && await lanza(() => a5.reaccionarMensaje(hola.id, 'ok')),
    'no a lo de Rubén, ni al programado, ni con algo que no es un emoji');
  // (v0.56, como la 034) cualquier emoji, con su tono de piel
  check(await a5.reaccionarMensaje(hola.id, '👍🏽') === '👍🏽' && await a5.reaccionarMensaje(hola.id, '👍🏽') === null, '(034) cualquier emoji, también con tono de piel');
  await b5.insert('comentario_reacciones', [{ comentario_id: hola.id, emoji: '💪', usuario_id: 'otro' }]);
  check((await b5.select('comentario_reacciones', {}))[0].usuario_id !== 'otro', 'la reacción va a su nombre aunque mande otro');
  await a5.destacar(hola.id, true);
  check((await a5.destacados(ana.id)).length === 1 && await lanza(() => a5.destacar(prog.id, true)), 'destacar (no el programado)');
  check((await a5.editarMensaje(r.id, 'Hola, Pelayo')).editado_en && await lanza(() => a5.editarMensaje(hola.id, 'x')), 'edita lo suyo (no lo del coach)');
  check(await lanza(() => b5.update('comentarios', { eliminado_en: new Date().toISOString() }, { eq: { id: r.id } })) && await lanza(() => b5.update('comentarios', { responde_a: null }, { eq: { id: r.id } })),
    '«eliminado» y la cita no se tocan a mano');
  check((await b5.delete('comentarios', { eq: { id: r.id } }), (await a5.conversacion(ana.id)).some((c) => c.id === r.id)), 'no borra a mano lo suyo');
  check((await a5.eliminarMensaje(r)).estado === 'eliminado' && (await a5.conversacion(ana.id)).find((c) => c.id === r.id).texto === 'Se eliminó este mensaje', 'lo elimina para todos');
  check(await lanza(() => a5.eliminarMensaje(hola)), 'no elimina lo del coach');
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await a5.destacados(ana.id)).length === 0, 'el coach no ve los destacados de Ana');
  check(!(await a5.conversacion(ana.id)).find((c) => c.id === r.id).texto.includes('Pelayo'), 'ni el texto de lo que Ana eliminó');
  check((await a5.buscarMensajes('pelayo')).every((m) => m.id !== r.id), 'ni lo encuentra al buscar');
  await a5.cambiarEstadoConversacion(ana.id, { archivada: true });
  const otros = atl.filter((x) => x.id !== ana.id);
  for (const x of otros.slice(0, 3)) await a5.cambiarEstadoConversacion(x.id, { fijada: true });
  check(await lanza(() => a5.cambiarEstadoConversacion(otros[3].id, { fijada: true })), 'como mucho 3 fijadas');
  check(!(await a5.estadoConversaciones())[ana.id]?.fijada_en, 'archivada, no se fija');
  await b5.auth.entrar('ana@fbe.demo', 'demo');
  check(Object.keys(await a5.estadoConversaciones()).length === 0 && await lanza(() => a5.cambiarEstadoConversacion(ana.id, { fijada: true })), 'Ana no ve ni toca el estado de las conversaciones');
  await a5.enviarMensaje(ana.id, { texto: 'Vuelvo', autor: 'atleta' });
  await a5.marcarPresencia();
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  check(!(await a5.estadoConversaciones())[ana.id].archivada_en, 'un mensaje nuevo de Ana la saca de archivadas');
  await a5.marcarPresencia();
  check(!!(await a5.ultimaConexion(ana.perfil_id)) && !(await a5.ultimaConexion(ruben.perfil_id)), 'el coach ve la última conexión de Ana (Rubén no ha entrado)');
  check(await lanza(() => b5.insert('presencia', [{ usuario_id: ana.perfil_id, ultima_conexion: new Date().toISOString() }])), 'la presencia no se escribe a mano');
  await b5.auth.entrar('ruben@fbe.demo', 'demo');
  check(!(await a5.ultimaConexion(ana.perfil_id)) && !!(await a5.ultimaConexion()), 'Rubén no ve la de Ana; sí la del coach');
  await b5.auth.entrar('ana@fbe.demo', 'demo');
  await a5.marcarPresencia(false);
  check(!(await a5.ultimaConexion()), 'Ana la oculta y deja de ver la del coach');
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  check(!(await a5.ultimaConexion(ana.perfil_id)) && (await a5.eliminarMensaje(prog)).estado === 'cancelado', 'el coach ya no ve la de Ana; y cancela su programado');
  check(b5.canalChat(ana.id, {}) === null || typeof b5.canalChat(ana.id, {})?.soltar === 'function', 'el canal de «escribiendo…» de la demo (sin BroadcastChannel, nada)');
}

console.log('\nLo que encontró la revisión de seguridad de la 032, también en la demo');
{
  const b6 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a6 = crearApi(b6);
  const coach = () => b6.auth.entrar('pelayo@fbe.demo', 'demo'), comoAna = () => b6.auth.entrar('ana@fbe.demo', 'demo');
  await coach();
  const ana = (await a6.atletas()).find((a) => a.nombre === 'Ana López');
  const hola = await a6.enviarMensaje(ana.id, { texto: 'Hola', autor: 'coach' });
  await comoAna();
  const foto = await a6.enviarMensaje(ana.id, { texto: 'Mi rodilla', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  const [adj] = await b6.select('archivos', { eq: { id: foto.archivo_id } });
  check(!!(await a6.urlArchivo(adj.ruta)), 'Ana ve su foto del chat');
  await coach();
  // (v0.55) la respuesta va al chat citando la foto (la demo, como la 033, no deja «pegarla» a la foto de Ana)
  check(await lanza(() => a6.comentar({ atletaId: ana.id, archivoId: adj.id, texto: 'Hielo hoy', autor: 'coach' })), '(033) el coach no pone en un mensaje suyo la foto que subió Ana');
  const resp = await a6.enviarMensaje(ana.id, { texto: 'Hielo hoy', autor: 'coach', respondeA: foto.id });
  await comoAna();
  await b6.delete('archivos', { eq: { id: adj.id } });
  check((await b6.select('archivos', { eq: { id: adj.id } })).length === 1 && (await b6.select('comentarios', { eq: { id: resp.id } })).length === 1,
    'M2: Ana no borra desde archivos una foto del chat con mensajes (ni se lleva el del coach)');
  check(!(await b6.storage.borrar([adj.ruta])).length && !!(await a6.urlArchivo(adj.ruta)), 'ni la borra de Storage a mano');
  const el = await a6.eliminarMensaje(foto);
  check(el.estado === 'eliminado' && el.almacenamiento === 'pendiente' && await lanza(() => a6.urlArchivo(adj.ruta)), 'M1: la elimina para todos y deja de verla al momento (queda en la cola)');
  check((await b6.select('comentarios', { eq: { id: resp.id } }))[0]?.texto === 'Hielo hoy', 'la respuesta del coach se queda');
  check(await lanza(() => b6.rpc('storage_pendiente', {})), 'Ana no ve la cola');
  await coach();
  check((await b6.rpc('storage_pendiente', {})).includes(adj.ruta) && (await a6.limpiarAlmacenamiento()) >= 1 && !(await b6.rpc('storage_pendiente', {})).length, 'el coach la vacía al abrir la app');
  check(await lanza(() => a6.urlArchivo(adj.ruta)), 'y ya no está en Storage');
  // Un adjunto que borra el coach (o una cascada): sus mensajes quedan eliminados, no desaparecen
  await comoAna();
  const foto2 = await a6.enviarMensaje(ana.id, { texto: 'Otra', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  await coach();
  await b6.delete('archivos', { eq: { id: foto2.archivo_id } });
  const f2 = (await b6.select('comentarios', { eq: { id: foto2.id } }))[0];
  check(f2?.eliminado_en && f2.texto === 'Se eliminó este mensaje' && !f2.archivo_id, 'el coach borra el adjunto: el mensaje queda «Se eliminó este mensaje»');
  // L2: de baja, ni reacciones, ni destacados, ni editar
  await comoAna();
  const mio = await a6.enviarMensaje(ana.id, { texto: 'Antes de la baja', autor: 'atleta' });
  await coach();
  await b6.update('atletas', { estado: 'baja' }, { eq: { id: ana.id } });
  await comoAna();
  check(await lanza(() => a6.reaccionarMensaje(hola.id, '👍')) && await lanza(() => a6.destacar(hola.id, true)) && await lanza(() => a6.editarMensaje(mio.id, 'Cambio')),
    'L2: de baja, Ana no reacciona, ni destaca, ni edita');
  await coach();
  await b6.update('atletas', { estado: 'activo' }, { eq: { id: ana.id } });
  // Leído: lo pone la base; no se adelanta ni vuelve a «no leído»
  await comoAna();
  await b6.update('comentarios', { leido_en: '2001-01-01T00:00:00Z' }, { eq: { id: hola.id } });
  const leido = (await b6.select('comentarios', { eq: { id: hola.id } }))[0].leido_en;
  check(leido && Math.abs(Date.parse(leido) - Date.now()) < 60000, 'el leído lo pone la base (no la hora que mande el móvil)');
  check(await lanza(() => b6.update('comentarios', { leido_en: null }, { eq: { id: hola.id } })), 'y no vuelve a «no leído»');
  // L3: sin «Mostrar cuándo estoy en línea», el leído es solo del día, y no hay canal de «escribiendo…»
  await a6.marcarPresencia(false);
  await coach();
  const hola2 = await a6.enviarMensaje(ana.id, { texto: 'Otro', autor: 'coach' });
  await comoAna();
  await a6.marcarLeidos?.([hola2.id]);
  if (!(await b6.select('comentarios', { eq: { id: hola2.id } }))[0].leido_en) await b6.update('comentarios', { leido_en: new Date().toISOString() }, { eq: { id: hola2.id } });
  const l2 = (await b6.select('comentarios', { eq: { id: hola2.id } }))[0].leido_en;
  check(l2 && /T(22|23):00:00/.test(new Date(l2).toISOString()), 'L3: oculta, su leído se guarda solo con el día (medianoche de Madrid)');
  check(b6.canalChat(ana.id, {}) === null, 'y no hay canal: ni «en línea» ni «escribiendo…»');
  // sesion_id y checkin_id no cambian al editar
  const conSesion = (await a6.conversacion(ana.id)).find((c) => c.sesion_id && c.autor === 'atleta');
  if (conSesion) check(await lanza(() => b6.update('comentarios', { sesion_id: null }, { eq: { id: conSesion.id } })), 'un mensaje no cambia de sesión al editarlo');
  check(typeof a6.borrarMensaje === 'undefined', 'ya no hay api.borrarMensaje');
}

console.log('\nEl chat, aún más como WhatsApp, en la demo (v0.55): las mismas reglas que la 033');
{
  const b7 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a7 = crearApi(b7);
  const coach = () => b7.auth.entrar('pelayo@fbe.demo', 'demo'), comoAna = () => b7.auth.entrar('ana@fbe.demo', 'demo'), comoRuben = () => b7.auth.entrar('ruben@fbe.demo', 'demo');
  await coach();
  const atl = await a7.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre.startsWith('Rubén')), sergio = atl.find((a) => a.estado === 'baja');
  check(await a7.chat033() === true, 'la demo tiene todo lo de la 033');
  // Sin duplicados y «Reenviado» solo con su función
  const cid = crypto.randomUUID();
  const m1 = await a7.enviarMensaje(ana.id, { texto: 'Uno', autor: 'coach', clienteId: cid });
  const m2 = await a7.enviarMensaje(ana.id, { texto: 'Uno', autor: 'coach', clienteId: cid });
  check(m1.id === m2.id && (await b7.select('comentarios', { eq: { cliente_id: cid } })).length === 1, 'el mismo id del móvil, una sola vez');
  await comoAna();
  const mA = (await b7.insert('comentarios', [{ atleta_id: ana.id, texto: 'Hola', reenviado: true, entregado_en: new Date().toISOString(), cliente_id: cid }]))[0];
  check(mA.reenviado === false && mA.entregado_en === null, 'Ana no pone «Reenviado» ni «entregado» a mano (y su id no choca con el del coach)');
  check(await lanza(() => b7.update('comentarios', { cliente_id: null }, { eq: { id: m1.id } })) && await lanza(() => b7.update('comentarios', { reenviado: true }, { eq: { id: m1.id } })), 'ni los cambia después');
  // Entregado
  await a7.marcarEntregados({ ya: true });
  check(!!(await b7.select('comentarios', { eq: { id: m1.id } }))[0].entregado_en && !(await b7.select('comentarios', { eq: { id: mA.id } }))[0].entregado_en, 'la app de Ana descarga lo del coach: entregado (lo suyo, no)');
  // PDF
  const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' }); pdf.name = 'Mi/analítica.pdf';
  const mPdf = await a7.enviarMensaje(ana.id, { texto: 'La analítica', archivo: pdf, autor: 'atleta', paginas: 1 });
  const [doc] = await b7.select('archivos', { eq: { id: mPdf.archivo_id } });
  check(doc.tipo === 'documento' && doc.nombre === 'analítica.pdf' && /\/documento-.*\.pdf$/.test(doc.ruta) && mPdf.adjunto === true, 'Ana manda un PDF (nombre saneado, ruta generada, como mensaje del chat)');
  check(await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-x.pdf`, mime: 'image/png', bytes: 10, nombre: 'x.pdf' }]))
    && await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-y.pdf`, mime: 'application/pdf', bytes: 30 * 1048576, nombre: 'y.pdf' }]))
    && await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-z.pdf`, mime: 'application/pdf', bytes: 10, nombre: '../z.pdf' }])), 'un documento: PDF, hasta 20 MB y con un nombre sin barras ni «..»');
  check(!(await b7.storage.borrar([doc.ruta])).length && (await b7.delete('archivos', { eq: { id: doc.id } }), (await b7.select('archivos', { eq: { id: doc.id } })).length === 1), 'Ana no lo borra a mano (ni de Storage ni de archivos)');
  await comoRuben();
  check(await lanza(() => a7.urlArchivo(doc.ruta)), 'Rubén no ve el PDF de Ana');
  // Fijar
  await coach();
  await a7.fijarMensaje(ana.id, m1.id, '7d');
  await comoAna();
  check((await a7.fijado(ana.id))?.comentario_id === m1.id && await lanza(() => a7.fijarMensaje(ana.id, mA.id, '7d')) && await lanza(() => b7.insert('conversacion_fijado', [{ atleta_id: ana.id, comentario_id: mA.id }])), 'el coach fija; Ana lo ve pero no fija');
  await comoRuben();
  check(!(await a7.fijado(ana.id)) && !(await b7.select('conversacion_fijado', {})).length, 'Rubén no ve lo fijado de Ana');
  await coach();
  const prog = await a7.enviarMensaje(ana.id, { texto: 'Mañana', autor: 'coach', enviarEn: new Date(Date.now() + 864e5).toISOString() });
  check(await lanza(() => a7.fijarMensaje(ana.id, prog.id, '7d')) && await lanza(() => a7.fijarMensaje(ruben.id, m1.id, '7d')), 'ni uno programado ni uno de otra conversación');
  await a7.eliminarMensaje(m1);
  check(!(await a7.fijado(ana.id)), 'eliminado para todos, se desfija');
  // Silenciar
  await comoAna();
  await a7.silenciar(ana.id, 'semana');
  check(!!(await a7.silencios())[ana.id] && await lanza(() => a7.silenciar(ruben.id, '8h')), 'Ana silencia el suyo (el de otro, no)');
  await coach();
  check(!Object.keys(await a7.silencios()).length, 'el coach no ve que Ana lo ha silenciado');
  await a7.silenciar(ana.id, 'siempre');
  check((await a7.silencios())[ana.id]?.hasta === null, 'el coach silencia a Ana «siempre»');
  await comoAna();
  check(Object.keys(await a7.silencios()).length === 1 && (await a7.silencios())[ana.id].usuario_id !== undefined, '(Ana solo ve el suyo)');
  // Listas de difusión, difundir y reenviar
  await coach();
  const lista = await a7.guardarListaDifusion({ nombre: 'Compiten', miembros: [ana.id, ruben.id, sergio.id] });
  const d = await a7.difundir({ listaId: lista.id, texto: 'Test de 1RM el sábado' });
  check(d.enviados === 2 && d.saltados === 1, 'difundir: Ana y Rubén, cada uno en su chat; Sergio (de baja), no');
  const foto = new Blob(['jpg'], { type: 'image/jpeg' }); foto.name = 'g.jpg';
  const df = await a7.difundir({ listaId: lista.id, texto: '', archivo: foto });
  const copias = (await b7.select('comentarios', { eq: { texto: 'Foto' } })).filter((c) => [ana.id, ruben.id].includes(c.atleta_id) && c.archivo_id);
  check(df.enviados === 2 && copias.length >= 2, 'con foto, cada uno con su copia');
  await comoRuben();
  const suya = (await a7.conversacion(ruben.id)).find((c) => c.texto === 'Foto' && c.archivo);
  check(!!suya && !!(await a7.urlArchivo(suya.archivo.ruta)) && suya.archivo.ruta.startsWith(`${ruben.id}/`), 'Rubén ve su copia (en su carpeta)');
  const deAna = copias.find((c) => c.atleta_id === ana.id);
  const [archAna] = await (async () => { await coach(); return b7.select('archivos', { eq: { id: deAna.archivo_id } }); })();
  await comoRuben();
  check(await lanza(() => a7.urlArchivo(archAna.ruta)), 'y no la de Ana');
  check(await lanza(() => a7.listasDifusion()).then(async (x) => x || !(await a7.listasDifusion()).length) && await lanza(() => a7.difundir({ listaId: lista.id, texto: 'x' })) && await lanza(() => a7.reenviar(suya, [ana.id])),
    'Rubén no ve las listas, ni difunde, ni reenvía');
  await coach();
  const g = await a7.enviarMensaje(ana.id, { texto: 'Guía', autor: 'coach' });
  const rr = await a7.reenviar(g, [ruben.id, sergio.id]);
  check(rr.enviados === 1 && rr.saltados === 1, 'el coach reenvía (Sergio, de baja, se salta)');
  await comoRuben();
  check((await a7.conversacion(ruben.id)).some((c) => c.texto === 'Guía' && c.reenviado), 'a Rubén le llega con «Reenviado»');
  await comoAna();
  const suyo = await a7.enviarMensaje(ana.id, { texto: 'Mi rodilla', autor: 'atleta' });
  await coach();
  check(await lanza(() => a7.reenviar(suyo, [ruben.id])), 'el coach no reenvía lo de un atleta');
  check(await lanza(() => b7.insert('listas_difusion', [{ nombre: 'compiten' }])), 'sin repetir el nombre de una lista');
  // (revisión de la 033) Lo que sube un atleta no lo pone el coach en un mensaje suyo, ni lo reenvía; quién lo subió no se cambia
  await comoAna();
  const fAna = await a7.enviarMensaje(ana.id, { texto: 'Mi analítica', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  const [archF] = await b7.select('archivos', { eq: { id: fAna.archivo_id } });
  check(archF.subido_por === 'atleta' && await lanza(() => b7.update('archivos', { subido_por: 'coach' }, { eq: { id: archF.id } })), '(revisión) la foto de Ana queda como suya, y no se cambia');
  await coach();
  check(await lanza(() => b7.insert('comentarios', [{ atleta_id: ana.id, archivo_id: archF.id, texto: 'Mira' }])) && await lanza(() => b7.update('archivos', { subido_por: 'coach' }, { eq: { id: archF.id } })),
    '(revisión) el coach no la pone en un mensaje suyo (ni se la apunta)');
  const fC = await a7.enviarMensaje(ana.id, { texto: 'Así', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'coach' });
  await comoRuben();
  const deRuben = (await b7.insert('archivos', [{ atleta_id: ruben.id, tipo: 'adjunto', ruta: `${ruben.id}/adjunto-propio.jpg`, mime: 'image/jpeg', bytes: 3 }]))[0];
  await coach();
  check(await lanza(() => b7.rpc('chat_reenviar', { p_comentario: fC.id, p_destinos: [{ atleta: ruben.id, archivo: deRuben.id }] })), '(revisión) la copia para reenviar, del coach (no una que subió Rubén)');
  // (revisión) Sin «Mostrar cuándo estoy en línea», abrir la app no marca entregado (diría cuándo la abre); leerlo, sí (con el día)
  const sinEnLinea = await a7.enviarMensaje(ana.id, { texto: 'Sin en línea', autor: 'coach' });
  await comoAna();
  await a7.marcarPresencia(false);
  check(await b7.rpc('marcar_entregados', {}) === 0 && !(await b7.select('comentarios', { eq: { id: sinEnLinea.id } }))[0].entregado_en, '(revisión) sin «en línea», abrir la app no marca entregado');
  await a7.marcarLeidos([sinEnLinea.id]);
  const [leidoSin] = await b7.select('comentarios', { eq: { id: sinEnLinea.id } });
  check(!!leidoSin.entregado_en && Date.parse(leidoSin.entregado_en) >= Date.parse(leidoSin.creado_en), '(revisión) al leerlo, entregado (nunca antes de escribirse)');
  await a7.marcarPresencia(true);
  // (revisión) El nombre de un documento, como la base: .pdf, sin invisibles ni marcas de dirección ni comillas
  check(await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-r1.pdf`, mime: 'application/pdf', bytes: 10, nombre: 'informe\u202Efdp.exe' }]))
    && await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-r2.pdf`, mime: 'application/pdf', bytes: 10, nombre: 'plan' }]))
    && await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-r3.pdf`, mime: 'application/pdf', bytes: 10, nombre: 'a\u200bb.pdf' }]))
    && await lanza(() => b7.insert('archivos', [{ atleta_id: ana.id, tipo: 'documento', ruta: `${ana.id}/documento-r4.pdf`, mime: 'application/pdf', bytes: 10, nombre: 'a"b".pdf' }])),
    '(revisión) el nombre de un PDF: acaba en .pdf y sin invisibles, marcas de dirección ni comillas');
  // Sin conexión, el mensaje no sale (la bandeja de salida lo guarda)
  const antes = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  const sinRed = await lanza(() => a7.enviarMensaje(ana.id, { texto: 'Sin red', autor: 'coach' }));
  Object.defineProperty(globalThis, 'navigator', { value: antes, configurable: true });
  check(sinRed, 'sin conexión, un mensaje no sale (como en el de verdad)');
  await comoAna();
  check(typeof (await a7.nombreCoach()) === 'string', 'el nombre del coach para «Info del contacto»');
}

console.log('\nNotas de voz, encuestas, «escuchado» y reacciones a elegir en la demo (v0.56): las mismas reglas que la 034');
{
  const b8 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a8 = crearApi(b8);
  const coach = () => b8.auth.entrar('pelayo@fbe.demo', 'demo'), comoAna = () => b8.auth.entrar('ana@fbe.demo', 'demo'), comoRuben = () => b8.auth.entrar('ruben@fbe.demo', 'demo');
  await coach();
  const atl = await a8.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre.startsWith('Rubén'));
  check(await a8.chat034() === true, 'la demo tiene todo lo de la 034');
  // Notas de voz
  await comoAna();
  const hoy = new Date().toISOString().slice(0, 10);
  const voz = (extra = {}) => ({ atleta_id: ana.id, tipo: 'audio', ruta: `${ana.id}/audio-${hoy}-${Math.random().toString(36).slice(2, 8)}.webm`, mime: 'audio/webm', bytes: 2000, duracion_seg: 10, ...extra });
  check(!!(await b8.insert('archivos', [voz({ onda: Array(16).fill(40) })]))[0], 'Ana registra una nota de voz');
  check(await lanza(() => b8.insert('archivos', [voz({ duracion_seg: 62 })])) && await lanza(() => b8.insert('archivos', [voz({ bytes: 3145729 })])) && await lanza(() => b8.insert('archivos', [voz({ mime: 'audio/wav' })]))
    && await lanza(() => b8.insert('archivos', [voz({ ruta: `${ana.id}/audio-${hoy}-x.exe` })])) && await lanza(() => b8.insert('archivos', [voz({ onda: [1, 2] })])) && await lanza(() => b8.insert('archivos', [voz({ nombre: 'x.webm' })])),
    'de 1 a 61 s, hasta 3 MB, de los formatos de grabar, con su ruta y una onda de 8 a 64 barras (como la base)');
  const mV = await a8.enviarMensaje(ana.id, { archivo: new File([new Uint8Array(900)], 'n.webm', { type: 'audio/webm;codecs=opus' }), autor: 'atleta', duracion_seg: 7.4, onda: Array(20).fill(30) });
  check(mV.texto === 'Nota de voz' && mV.adjunto === true && (await b8.select('archivos', { eq: { id: mV.archivo_id } }))[0].mime === 'audio/webm', 'Ana manda una por el chat («Nota de voz», como adjunto del chat)');
  const [arV] = await b8.select('archivos', { eq: { id: mV.archivo_id } });
  check(!(await b8.storage.borrar([arV.ruta])).length && (await b8.delete('archivos', { eq: { id: arV.id } }), (await b8.select('archivos', { eq: { id: arV.id } })).length === 1), 'Ana no la borra a mano (ni de Storage ni de archivos)');
  check(await lanza(() => b8.update('comentarios', { escuchado_en: new Date().toISOString() }, { eq: { id: mV.id } })), 'nadie pone «escuchado» a mano');
  await coach();
  check(await lanza(() => b8.insert('comentarios', [{ atleta_id: ana.id, archivo_id: arV.id, texto: 'Nota de voz' }])), 'el coach no pone la de Ana en un mensaje suyo');
  check(!!(await a8.marcarEscuchado(mV.id)) && !!(await b8.select('comentarios', { eq: { id: mV.id } }))[0].escuchado_en, 'el coach la escucha: escuchada');
  const deCoach = await a8.enviarMensaje(ana.id, { archivo: new File([new Uint8Array(300)], 'n.webm', { type: 'audio/webm' }), autor: 'coach', duracion_seg: 3 });
  await comoRuben();
  check((await a8.marcarEscuchado(deCoach.id)) === null && !(await b8.select('comentarios', { eq: { id: deCoach.id } })).length, 'Rubén ni la ve ni la marca');
  await comoAna();
  await a8.marcarPresencia(false);
  check((await a8.marcarEscuchado(deCoach.id)) === null, 'con «en línea» apagado, Ana la escucha y no se apunta');
  await a8.marcarPresencia(true);
  check(!!(await a8.marcarEscuchado(deCoach.id)), 'con él encendido, sí');
  const cuarenta = [];
  for (let i = 0; i < 61; i++) { try { await b8.insert('archivos', [voz()]); cuarenta.push(i); } catch (e) { cuarenta.push(e.message); break; } }
  check(/60 notas de voz/.test(String(cuarenta.at(-1))), 'como mucho 60 al día (el atleta)');
  // Encuestas
  await coach();
  const r = await a8.crearEncuestaChat({ atletaId: ana.id, pregunta: '¿Qué día?', opciones: ['Lunes', 'Martes'] });
  check(r.enviados === 1, 'el coach manda una encuesta a Ana');
  check(await lanza(() => b8.insert('encuestas_chat', [{ comentario_id: mV.id, atleta_id: ana.id, pregunta: 'x', opciones: ['a', 'b'] }])) && await lanza(() => b8.rpc('chat_encuesta', { p_atleta: ana.id, p_pregunta: 'x', p_opciones: ['a', 'A'] })),
    'no se crea a mano; las opciones, sin repetir');
  await comoAna();
  const conE = (await a8.conversacion(ana.id)).find((c) => c.encuesta);
  check(!!conE && igualD(await a8.votarEncuestaChat(conE.encuesta.id, [0]), [0]) && await lanza(() => a8.votarEncuestaChat(conE.encuesta.id, [0, 1])) && await lanza(() => a8.votarEncuestaChat(conE.encuesta.id, [7])),
    'Ana vota (una sola, y de las que hay)');
  check(await lanza(() => b8.insert('encuesta_votos', [{ encuesta_id: conE.encuesta.id, atleta_id: ana.id, opciones: [1] }])) && await lanza(() => a8.editarMensaje(conE.id, 'otra')), 'ni vota a mano, ni se edita el mensaje de la encuesta');
  await comoRuben();
  check(!(await b8.select('encuestas_chat', {})).length && !(await b8.select('encuesta_votos', {})).length && await lanza(() => a8.votarEncuestaChat(conE.encuesta.id, [1])), 'Rubén no ve la de Ana, ni su voto, ni vota en ella');
  await coach();
  check(igualD((await a8.conversacion(ana.id)).find((c) => c.id === conE.id).encuesta.voto, [0]) && await lanza(() => a8.votarEncuestaChat(conE.encuesta.id, [1])), 'el coach ve el voto (y no vota)');
  await a8.eliminarMensaje((await a8.conversacion(ana.id)).find((c) => c.id === conE.id));
  check(!(await b8.select('encuestas_chat', {})).some((e) => e.comentario_id === conE.id) && !(await b8.select('encuesta_votos', {})).some((v) => v.encuesta_id === conE.encuesta.id), 'eliminado el mensaje, la encuesta y su voto se van');
  // Reacciones: cualquier emoji
  await comoAna();
  const paraR = (await a8.conversacion(ana.id)).find((c) => c.autor === 'coach' && !c.eliminado_en && !c.archivo);
  check(await a8.reaccionarMensaje(paraR.id, '🔥') === '🔥' && await lanza(() => b8.insert('comentario_reacciones', [{ comentario_id: paraR.id, emoji: 'hola' }])), 'cualquier emoji como reacción; texto, no');
  // La subida lenta de la demo (para el progreso y «Cancelar»)
  const memL = new Map();
  globalThis.localStorage = { getItem: (k) => memL.get(k) ?? null, setItem: (k, v) => memL.set(k, String(v)), removeItem: (k) => memL.delete(k) };
  memL.set('fbe-demo-subida-lenta', '400');
  const pasos = [];
  const senal = {};
  const subida = a8.enviarMensaje(ana.id, { archivo: new File([new Uint8Array(500)], 'foto.jpg', { type: 'image/jpeg' }), autor: 'atleta', alProgreso: (x) => pasos.push(x), senal });
  await new Promise((ok) => setTimeout(ok, 150));
  senal.abortar();
  let cancelado = false;
  try { await subida; } catch (e) { cancelado = !!e.cancelado; }
  check(cancelado && pasos.length >= 1 && pasos.every((x) => x > 0 && x < 1) && !(await b8.select('archivos', { eq: { atleta_id: ana.id, tipo: 'adjunto' } })).some((x) => x.ruta.endsWith('.jpg') && x.bytes === 500),
    'en la demo, la subida va por pasos (el progreso) y «Cancelar» la para y retira su registro');
  delete globalThis.localStorage;

  // (revisión) Como la 034: las notas de voz, en su bucket «voz»; la cola con su bucket; rutas en la cola, no se reusan;
  // las encuestas no se reenvían; teclas y banderas de etiquetas como reacción
  await comoAna();
  const [vzD] = await b8.insert('archivos', [{ ...voz(), ruta: `${ana.id}/audio-${hoy}-dm${Date.now() % 1e6}.webm` }]).catch(async () => { await coach(); return b8.insert('archivos', [voz()]); });
  await comoAna();
  check(await lanza(() => b8.storage.subir(vzD.ruta, new Blob([new Uint8Array(10)], { type: 'audio/webm' }), 'audio/webm')) && !(await lanza(() => b8.storage.subir(vzD.ruta, new Blob([new Uint8Array(10)], { type: 'audio/webm' }), 'audio/webm', { bucket: 'voz' }))),
    '(revisión) una nota de voz no va a «archivos»; a «voz», sí');
  check(await lanza(() => b8.storage.subir(`${ana.id}/audio-${hoy}-sinfila.webm`, new Blob([new Uint8Array(10)]), 'audio/webm', { bucket: 'voz' }))
    && await lanza(() => b8.storage.subir(vzD.ruta, new Blob([new Uint8Array(10)]), 'audio/wav', { bucket: 'voz' })), '(revisión) a «voz», solo lo registrado y en audio');
  check((await a8.urlArchivo(vzD.ruta, { tipo: 'audio' })) !== null, '(revisión) y su enlace sale de «voz»');
  await coach();
  check(Array.isArray(await b8.rpc('storage_pendiente_cubos', { p_limite: 50 })), '(revisión) la cola de Storage, con el bucket de cada ruta (el coach)');
  await comoAna();
  check(await lanza(() => b8.rpc('storage_pendiente_cubos', { p_limite: 50 })), '(solo el coach)');
  // Ana elimina su nota de voz para todos: su ruta espera en la cola (la vacía el coach) con el bucket «voz»
  await a8.eliminarMensaje((await a8.conversacion(ana.id)).find((c) => c.id === mV.id));
  await coach();
  const enCola = (await b8.rpc('storage_pendiente_cubos', { p_limite: 500 })).find((x) => x.ruta === arV.ruta);
  check(enCola?.bucket === 'voz', '(revisión) al eliminarla, su ruta espera en la cola con el bucket «voz»');
  let errReD = '';
  try { await b8.insert('archivos', [{ ...voz(), ruta: arV.ruta }]); } catch (e) { errReD = e.message; }
  check(/ya se usó para un archivo eliminado/.test(errReD), '(revisión) una ruta que espera en la cola no se vuelve a registrar (tampoco el coach)');
  const rE2 = await a8.crearEncuestaChat({ atletaId: ana.id, pregunta: '¿Otra?', opciones: ['Sí', 'No'] });
  const conE2 = (await a8.conversacion(ana.id)).find((c) => c.encuesta && c.encuesta.pregunta === '¿Otra?');
  let errFwD = '';
  try { await a8.reenviar(conE2, [ruben.id]); } catch (e) { errFwD = e.message; }
  check(rE2.enviados === 1 && /Una encuesta no se reenvía/.test(errFwD), '(revisión) una encuesta no se reenvía (como la base)');
  await comoAna();
  check(await lanza(() => a8.votarEncuestaChat(conE2.encuesta.id, [40000])), '(revisión) un voto a la opción 40000, rechazado con el aviso de siempre');
  check(await a8.reaccionarMensaje(paraR.id, '1️⃣') === '1️⃣' && await a8.reaccionarMensaje(paraR.id, '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}') !== undefined
    && await lanza(() => b8.update('comentario_reacciones', { emoji: '\u{E0067}\u{E0062}' }, { eq: { comentario_id: paraR.id } })), '(revisión) teclas y banderas de etiquetas, sí; etiquetas sueltas, no');

  // (v0.56) El aviso de privacidad, como la 034
  await comoAna();
  check((await a8.privacidadVista()).version === VERSION_LEGAL_D, 'en la demo, todos han visto ya la política actual (no sale al entrar)');
  const anaUid = b8.auth.sesion().user.id;
  check((await b8.update('privacidad_vista', { version: '2026-01' }, { eq: { usuario_id: anaUid } }))[0].version === VERSION_LEGAL_D, 'nunca hacia atrás');
  check(await lanza(() => b8.update('privacidad_vista', { version: '2099-01' }, { eq: { usuario_id: anaUid } })) && await lanza(() => b8.upsert('privacidad_vista', [{ usuario_id: anaUid, version: '2026-13' }], 'usuario_id')),
    'ni una de dentro de años ni sin formato');
  await comoRuben();
  const rubenUid = b8.auth.sesion().user.id;
  await b8.upsert('privacidad_vista', [{ usuario_id: anaUid, version: '2026-10' }], 'usuario_id');
  check(!(await b8.select('privacidad_vista', {})).some((x) => x.usuario_id === anaUid) && (await b8.select('privacidad_vista', {})).every((x) => x.usuario_id === rubenUid)
    && !(await b8.update('privacidad_vista', { version: VERSION_LEGAL_D }, { eq: { usuario_id: anaUid } })).length, 'Rubén ni ve ni cambia la de Ana (con su usuario, solo la suya)');
  await coach();
  check((await a8.privacidadVistaDe(anaUid))?.version === VERSION_LEGAL_D, 'el coach la ve en la ficha');
}

console.log('\nLos vídeos de técnica en la demo (v0.57): las mismas reglas que la 035');
{
  const b9 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a9 = crearApi(b9);
  const coach = () => b9.auth.entrar('pelayo@fbe.demo', 'demo'), comoAna = () => b9.auth.entrar('ana@fbe.demo', 'demo'), comoRuben = () => b9.auth.entrar('ruben@fbe.demo', 'demo');
  await coach();
  const atl = await a9.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre.startsWith('Rubén'));
  check(await a9.video035() === true, 'la demo tiene todo lo de la 035');
  // La semilla: la serie del vídeo de Ana, las correcciones de Rubén y la lista de la sentadilla
  const dAna = await a9.diario(ana.id);
  const vAna = dAna.find((x) => x.tipo === 'video_tecnica' && !x.revisado_en);
  check(/^Serie \d/.test(`Serie ${vAna.serie?.numero}`) && /kg × \d+/.test(vAna.serie?.texto || '') && vAna.estado.estado === 'enviado', 'el vídeo de Ana por revisar, con su serie («kg × reps @RPE») y «Enviado»');
  const dRub = await a9.diario(ruben.id);
  const corr = dRub.find((x) => x.revision?.tempo);
  check(corr && corr.revision.puntuacion === 3 && corr.revision.checklist.puntos.length === 3 && corr.estado.estado === 'corregido' && dRub.filter((x) => x.revision?.puntuacion).length === 2,
    'Rubén tiene un vídeo corregido (nota, puntos y tempo) y otro con nota, para su gráfica');
  const sent = dAna.find((x) => x.ejercicio?.nombre === 'Sentadilla barra alta').ejercicio;
  check((await a9.plantillaTecnica(sent.id))?.length === 5, 'y el coach tiene su lista de puntos clave de la sentadilla');
  check((await a9.miTecnica(ruben.id)).find((g) => g.nombre === 'Sentadilla barra alta').puntos.length === 2, '«Mi técnica» de Rubén: dos notas en la gráfica');
  // Lo que solo hace el coach
  await comoAna();
  check(await lanza(() => b9.insert('video_revisiones', [{ archivo_id: vAna.id, atleta_id: ana.id, puntuacion: 5 }])) && await lanza(() => b9.rpc('video_visto', { p_archivo: vAna.id }))
    && !(await b9.update('video_revisiones', { puntuacion: 5 }, { eq: { archivo_id: corr.id } })).length && !(await b9.select('tecnica_plantillas', {})).length
    && await lanza(() => b9.insert('tecnica_plantillas', [{ ejercicio_id: sent.id, puntos: ['x'] }])) && await lanza(() => b9.rpc('videos_limpieza', { p_meses: 6, p_dias: 30 })),
    'Ana ni se corrige, ni se marca «Visto», ni ve ni escribe las listas, ni limpia');
  // (revisión de seguridad, H1) la tabla, con horas, solo el coach; Ana lee las suyas con días (video_correcciones)
  const idsTodos = [...dAna, ...dRub].filter((x) => x.tipo === 'video_tecnica').map((x) => x.id);
  const deAna = await b9.rpc('video_correcciones', { p_archivos: idsTodos });
  check(!(await b9.select('video_revisiones', {})).length && deAna.length >= 2 && deAna.every((r) => r.atleta_id === ana.id)
    && deAna.every((r) => !Object.keys(r).some((k) => /_en$/.test(k)) && (r.visto_el == null || /^\d{4}-\d{2}-\d{2}$/.test(r.visto_el)) && (r.corregido_el == null || /^\d{4}-\d{2}-\d{2}$/.test(r.corregido_el))),
    'y solo ve las correcciones de sus vídeos, con el día de «Visto» y de «Corregido» (nunca la hora, ni la tabla)');
  // La serie y repetir, como la 035
  const seAna = vAna.sesion_ejercicio_id;
  const seRub = (await b9.select('archivos', { eq: { atleta_id: ruben.id } })).find((x) => x.sesion_ejercicio_id)?.sesion_ejercicio_id;
  const nuevo = (extra) => ({ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-057-${Math.random().toString(36).slice(2, 8)}.mp4`, ...extra });
  check(!!(await b9.insert('archivos', [nuevo({ sesion_ejercicio_id: seAna, serie_numero: 1 })]))[0] && await lanza(() => b9.insert('archivos', [nuevo({ sesion_ejercicio_id: seRub, serie_numero: 1 })]))
    && await lanza(() => b9.insert('archivos', [nuevo({ sesion_ejercicio_id: seAna, serie_numero: 31 })])) && await lanza(() => b9.insert('archivos', [nuevo({ repite_de: corr.id })])),
    'la serie, de su sesión (no una de Rubén ni la 31); repetir, un vídeo suyo');
  const repe = (await b9.insert('archivos', [nuevo({ repite_de: vAna.id })]))[0];
  check(repe.repite_de === vAna.id && await lanza(() => b9.update('archivos', { repite_de: null, serie_numero: 2 }, { eq: { id: repe.id } })), 'repite su vídeo; luego no cambia la serie ni lo que repite');
  // La corrección (el coach)
  await coach();
  check(await b9.rpc('video_visto', { p_archivo: vAna.id }) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date()), 'el coach lo abre: «Visto» con el día de hoy');
  check(await lanza(() => a9.guardarRevision(vAna, { puntuacion: 6 })) && await lanza(() => b9.upsert('video_revisiones', [{ archivo_id: vAna.id, atleta_id: ana.id, tempo: { reps: [[0, 1, 30]] } }], 'archivo_id'))
    && await lanza(() => b9.upsert('video_revisiones', [{ archivo_id: vAna.id, atleta_id: ana.id, checklist: { puntos: [{ t: '', e: 'bien' }] } }], 'archivo_id')), 'con las mismas reglas: nota, tempo dentro del vídeo, puntos con su forma');
  const [antesVisto] = await b9.select('video_revisiones', { eq: { archivo_id: vAna.id } });
  await b9.rpc('video_visto', { p_archivo: vAna.id });
  check((await b9.select('video_revisiones', { eq: { archivo_id: vAna.id } }))[0].actualizado_en === antesVisto.actualizado_en, '(revisión) abrirlo otra vez no cambia la fila');
  const r = await a9.guardarRevision(vAna, { puntuacion: 4, checklist: [{ t: 'Rodillas', e: 'mal', s: 1 }], tempo: { reps: [[0.2, 1, 1.6]] } });
  const [rA0] = await b9.select('video_revisiones', { eq: { archivo_id: vAna.id } });
  await b9.upsert('video_revisiones', [{ archivo_id: vAna.id, atleta_id: ruben.id, corregido_en: '2020-01-01T00:00:00Z', visto_el: '2020-01-01' }], 'archivo_id');
  const [rB] = await b9.select('video_revisiones', { eq: { archivo_id: vAna.id } });
  check(r.corregido_el && rB.atleta_id === ana.id && rB.corregido_en === rA0.corregido_en && rB.visto_el !== '2020-01-01', '«Visto» y «Corregido» los pone la «base» (no se fechan a mano) y la corrección es de Ana');
  // La voz
  await comoAna();
  const vozAna = (await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'audio', ruta: `${ana.id}/audio-057-a.webm`, mime: 'audio/webm', bytes: 900, duracion_seg: 5 }]))[0];
  await coach();
  check(await lanza(() => b9.update('video_revisiones', { voz_archivo_id: vozAna.id }, { eq: { archivo_id: vAna.id } })), 'la voz, una nota de voz del coach (no una de Ana)');
  const rv = await a9.guardarVozVideo(vAna, new File([new Uint8Array(1000)], 'v.webm', { type: 'audio/webm' }), { inicio: 0.5, seg: 4 });
  const rv2 = await a9.guardarVozVideo(vAna, new File([new Uint8Array(1000)], 'v.webm', { type: 'audio/webm' }), { inicio: 0, seg: 3 });
  check(rv.voz_archivo_id && rv2.voz_archivo_id !== rv.voz_archivo_id && !(await b9.select('archivos', { eq: { id: rv.voz_archivo_id } })).length, 'el coach pone su voz; otra la cambia (y la de antes se borra)');
  await comoAna();
  check(!(await b9.delete('archivos', { eq: { id: rv2.voz_archivo_id } })) && (await b9.select('archivos', { eq: { id: rv2.voz_archivo_id } })).length === 1, 'Ana no borra la voz de su coach');
  // (revisión de seguridad, M2) la voz del vídeo no va en un mensaje; una nota de voz del chat no es la voz de un vídeo
  await coach();
  check(await lanza(() => b9.insert('comentarios', [{ atleta_id: ana.id, archivo_id: rv2.voz_archivo_id, texto: 'Nota de voz' }])), '(revisión) la voz del vídeo no se pone en un mensaje');
  const notaChat = await a9.enviarMensaje(ana.id, { archivo: new File([new Uint8Array(800)], 'n.webm', { type: 'audio/webm' }), autor: 'coach', duracion_seg: 3 });
  check(await lanza(() => b9.update('video_revisiones', { voz_archivo_id: notaChat.archivo_id }, { eq: { archivo_id: vAna.id } })), '(revisión) ni una nota de voz del chat se usa como voz del vídeo');
  // (revisión de seguridad, M1) el fotograma: lo marca la base, no se cambia y no se reenvía
  const foto = await a9.enviarFotograma(vAna, new Blob([new Uint8Array(200)], { type: 'image/jpeg' }), { texto: 'Mira' });
  const [fotoA] = await b9.select('archivos', { eq: { id: foto.archivo_id } });
  check(fotoA.derivado_de === vAna.id && await lanza(() => b9.update('archivos', { derivado_de: null }, { eq: { id: fotoA.id } })), '(revisión) el fotograma lleva de qué vídeo sale, y no se quita');
  const copiaF = (await b9.insert('archivos', [{ atleta_id: ruben.id, tipo: 'adjunto', ruta: `${ruben.id}/adjunto-057-f.jpg`, mime: 'image/jpeg', bytes: 200 }]))[0];
  check(await lanza(() => b9.rpc('chat_reenviar', { p_comentario: foto.id, p_destinos: [{ atleta: ruben.id, archivo: copiaF.id }] }))
    && await lanza(() => b9.insert('archivos', [{ atleta_id: ruben.id, tipo: 'adjunto', ruta: `${ruben.id}/adjunto-057-g.jpg`, mime: 'image/jpeg', derivado_de: vAna.id }])),
    '(revisión) no se reenvía a Rubén, ni se hace pasar por un fotograma de otro atleta');
  await comoAna();
  check(await lanza(() => b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'adjunto', ruta: `${ana.id}/adjunto-057-h.jpg`, mime: 'image/jpeg', derivado_de: vAna.id }])), '(revisión) un atleta no marca fotogramas');
  // (revisión de seguridad, H2) el día de un archivo del atleta, como mucho mañana; cuándo llegó, la base
  const futuro = (await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-057-fut.mp4`, fecha: '2099-01-01', creado_en: '2020-01-01T00:00:00Z' }]))[0];
  check(futuro.fecha <= sumarDias(hoyISO(), 1) && Date.parse(futuro.creado_en) > Date.now() - 60000, '(revisión) un día del futuro se queda en mañana, y cuándo llegó no se pone a mano');
  // La limpieza
  await coach();
  const viejo = (await b9.insert('archivos', [{ atleta_id: ruben.id, tipo: 'video_tecnica', ruta: `${ruben.id}/video-viejo-057.mp4`, fecha: '2025-01-01', creado_en: '2025-01-01T10:00:00Z', revisado_en: '2025-01-02T10:00:00Z', bytes: 5000 }]))[0];
  await comoAna();
  const atrasado = (await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-057-atras.mp4`, fecha: '2021-01-01' }]))[0];
  await coach();
  const sinRevisar = (await b9.insert('archivos', [{ atleta_id: ruben.id, tipo: 'video_tecnica', ruta: `${ruben.id}/video-viejo-057b.mp4`, fecha: '2025-01-01', creado_en: '2025-01-01T10:00:00Z', bytes: 5000 }]))[0];
  const vista = await a9.limpiezaVideos({ meses: 6, dias: 30 });
  check(vista.lista.some((x) => x.id === viejo.id) && !vista.lista.some((x) => x.id === vAna.id || x.destacado), 'la limpieza enseña lo viejo (nunca lo reciente ni lo destacado)');
  check(!vista.lista.some((x) => x.id === atrasado.id) && !vista.lista.some((x) => x.id === sinRevisar.id) && await lanza(() => a9.limpiezaVideos({ meses: 6, dias: 0 })),
    '(revisión) ni uno con el día puesto atrás a mano (llegó hoy), ni uno que aún espera en la cola, y la conversación protege al menos 7 días');
  check((await a9.borrarVideosViejos({ meses: 6, dias: 30, ids: [viejo.id, vAna.id] })).n === 1 && (await b9.select('archivos', { eq: { id: vAna.id } })).length === 1, 'y borra solo lo que sigue cumpliéndolo');
  // Al borrar el vídeo, su corrección y la voz se van; la repetición se queda suelta; un dibujo en su hilo no lo impide
  await a9.comentar({ atletaId: ana.id, archivoId: vAna.id, texto: 'Mira', autor: 'coach', dibujo: { t: 1, hasta: 2, formas: [{ tipo: 'flecha', p: [[0, 0], [1, 1]], c: 'rojo' }, { tipo: 'texto', p: [[0.5, 0.5]], x: 'Rodillas' }] } });
  check(await lanza(() => a9.comentar({ atletaId: ana.id, archivoId: vAna.id, texto: 'x', autor: 'coach', dibujo: { t: 1, formas: [{ tipo: 'texto', p: [[0, 0]] }] } })), 'los dibujos nuevos, con su forma (un texto sin texto, no)');
  await comoAna();
  await a9.borrarArchivo(vAna);
  await coach();
  check(!(await b9.select('video_revisiones', { eq: { archivo_id: vAna.id } })).length && !(await b9.select('archivos', { eq: { id: rv2.voz_archivo_id } })).length && (await b9.select('archivos', { eq: { id: repe.id } }))[0].repite_de === null,
    'al borrarlo, su corrección y la voz se van (y la repetición queda suelta)');
  // (revisión de seguridad, L4) el coach pasa un vídeo a otro atleta: su corrección va con él (sin la voz) y Ana ya no la ve
  {
    await comoAna();
    const vM = (await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-057-mover.mp4`, duracion_seg: 8 }]))[0];
    const vRep = (await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-057-mover2.mp4`, repite_de: vM.id }]))[0];
    await coach();
    const rvM = await a9.guardarVozVideo(vM, new File([new Uint8Array(500)], 'v.webm', { type: 'audio/webm' }), { inicio: 0, seg: 2 });
    await a9.guardarRevision(vM, { puntuacion: 3 });
    await b9.update('archivos', { atleta_id: ruben.id, ruta: `${ruben.id}/video-057-mover.mp4` }, { eq: { id: vM.id } });
    const [revM] = await b9.select('video_revisiones', { eq: { archivo_id: vM.id } });
    check(revM.atleta_id === ruben.id && revM.voz_archivo_id === null && !(await b9.select('archivos', { eq: { id: rvM.voz_archivo_id } })).length
      && (await b9.select('archivos', { eq: { id: vRep.id } }))[0].repite_de === null, '(revisión) al pasarlo a Rubén, su corrección va con él, sin la voz (era de Ana), y la repetición de Ana queda suelta');
    await comoAna();
    check(!(await b9.rpc('video_correcciones', { p_archivos: [vM.id] })).length, '(revisión) y Ana ya no la ve');
    await coach();
  }
  // La subida «por trozos» de la demo sigue por donde iba
  const memL = new Map();
  globalThis.localStorage = { getItem: (k) => memL.get(k) ?? null, setItem: (k, v) => memL.set(k, String(v)), removeItem: (k) => memL.delete(k) };
  memL.set('fbe-demo-subida-lenta', '300');
  const antes = globalThis.navigator;
  let dir = null; const pasos = [];
  await comoAna();
  const f = await b9.insert('archivos', [{ atleta_id: ana.id, tipo: 'video_tecnica', ruta: `${ana.id}/video-trozos.mp4` }]);
  const p1 = b9.storage.subir(`${ana.id}/video-trozos.mp4`, new Blob(['x']), 'video/mp4', { alUrlSubida: (u) => { dir = u; }, alProgreso: (x) => pasos.push(x) });
  await new Promise((ok) => setTimeout(ok, 140));
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  let corte = null; try { await p1; } catch (e) { corte = e; }
  Object.defineProperty(globalThis, 'navigator', { value: antes, configurable: true });
  const hasta = pasos.at(-1);
  const pasos2 = [];
  await b9.storage.subir(`${ana.id}/video-trozos.mp4`, new Blob(['x']), 'video/mp4', { urlSubida: dir, alProgreso: (x) => pasos2.push(x) });
  check(corte?.sinConexion && f.length === 1 && dir && hasta > 0 && pasos2[0] >= hasta, `sin cobertura a media subida, sigue después por donde iba (${Math.round(hasta * 100)} % → ${Math.round(pasos2[0] * 100)} %)`);
  delete globalThis.localStorage;
}

console.log('\nv0.58: el análisis automático de los vídeos (como la 036)');
{
  const { VALIDOS, MALFORMADOS } = await import('./analisis-casos.mjs');
  const { limpiarAnalisis, repeticiones, calibracion } = await import('../web/src/logica/analisis.js');
  const bA = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const apiA = crearApi(bA);
  await bA.auth.entrar('pelayo@fbe.demo', 'demo');
  const carlos = (await apiA.atletas()).find((a) => a.nombre === 'Carlos Vera');
  const vid = (await apiA.archivos(carlos.id, 'video_tecnica')).find((a) => /ejemplo-barra\.webm$/.test(a.ruta));
  check(vid && vid.mime === 'video/webm' && vid.duracion_seg === 6 && vid.revisado_en && (await apiA.bandeja()).archivos.every((a) => a.id !== vid.id), 'la demo trae el vídeo de la barra de Carlos (WebM, ya revisado: no espera en la bandeja)');
  check(await apiA.video036() === true, 'y la demo tiene lo de la 036');
  // La misma forma que la base: el mismo juego de casos
  const raw = (j) => bA.upsert('video_revisiones', [{ archivo_id: vid.id, atleta_id: carlos.id, analisis: JSON.parse(j) }], 'archivo_id').then(() => true, () => false);
  const okV = []; for (const j of VALIDOS.slice(0, 5)) okV.push(await raw(j));
  // (el «null» de JSON, en la app, es no tener análisis: como un null de la base)
  const okM = []; for (const j of MALFORMADOS.filter((x) => x !== 'null')) okM.push(await raw(j));
  check(okV.every(Boolean) && okM.every((x) => !x), `la demo acepta los bien formados y rechaza los ${okM.length} mal formados, como analisis_valido()`);
  check(!(await raw(JSON.stringify({ v: 1, barra: { p: [[0, 0.5, 0.5], [7.5, 0.5, 0.5]] } }))), 'y lo que se sale del vídeo (6 s, con 1 s de margen)');
  await bA.delete('video_revisiones', { eq: { archivo_id: vid.id } });
  const p = []; for (let t = 0; t <= 5; t += 1 / 30) p.push([t, 0.5, (200 + 80 * (1 - Math.cos(2 * Math.PI * t / 1.6))) / 640]);
  const cal = calibracion(45, 90, 360, 640);
  const analisis = limpiarAnalisis({ barra: { p }, cal, reps: repeticiones(p, { cal }) });
  const r = await apiA.guardarAnalisis(vid, analisis);
  check(r.analisis?.reps?.length === 3 && r.corregido_el && r.puntuacion == null, 'el coach lo guarda en la demo: cuenta como corrección');
  await bA.auth.entrar('carlos@fbe.demo', 'demo');
  const vis = await apiA.revisionVideo(vid.id);
  check(vis.analisis?.reps?.[2]?.vm === analisis.reps[2].vm && !Object.keys(vis).some((k) => /_en$/.test(k)) && await lanza(() => apiA.guardarAnalisis(vid, analisis)) && !(await bA.select('video_revisiones', {})).length,
    'Carlos lo lee con video_correcciones() (sin horas) y no lo puede guardar ni leer la tabla');
  await bA.auth.entrar('ana@fbe.demo', 'demo');
  check(await apiA.revisionVideo(vid.id) === null, 'Ana no ve el de Carlos');
  // (v0.58, la prueba de punta a punta fallaba a ratos con ERR_FILE_NOT_FOUND) Los dos vídeos de Rubén comparten el
  // ejemplo de la demo: borrar uno no suelta el blob que sigue usando el otro
  {
    const { resolveObjectURL } = await import('node:buffer');
    await bA.auth.entrar('pelayo@fbe.demo', 'demo');
    const ruben = (await apiA.atletas()).find((a) => a.nombre === 'Rubén Martín');
    const [v1, v2] = await apiA.archivos(ruben.id, 'video_tecnica');
    const u1 = await apiA.urlArchivo(v1.ruta);
    await apiA.borrarArchivo(v2);
    check(v1.ruta === v2.ruta && /^blob:/.test(u1) && resolveObjectURL(u1)?.size > 1000 && await apiA.urlArchivo(v1.ruta) === u1,
      'borrar un vídeo de la demo no suelta el blob del ejemplo que comparte con otro (el que se está viendo sigue cargando)');
  }
}

console.log('\nv0.59: los vídeos de técnica, tanda A, en la demo (las mismas reglas que la 037)');
{
  const { limpiarAutoevaluacion } = await import('../web/src/logica/correccion.js');
  const bT = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const aT = crearApi(bT);
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const atl = await aT.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre === 'Rubén Martín');
  const sent = (await aT.biblioteca()).find((e) => e.nombre === 'Sentadilla barra alta');
  check(await aT.video037() === true, 'la demo tiene lo de la 037');
  // La demo trae: lo que nota Ana del vídeo que espera revisión y el vídeo modelo de la sentadilla
  const band = await aT.bandeja();
  const vPend = band.archivos.find((a) => a.atleta_id === ana.id && a.tipo === 'video_tecnica');
  check(vPend?.autoevaluacion?.rpe === 8.5 && vPend.autoevaluacion.molestia === false, 'la bandeja del coach trae lo que nota Ana de su vídeo (RPE 8,5, sin molestias)');
  const mods = await aT.videosModelo([sent.id]);
  check(mods.length === 1 && mods[0].angulo === 'De lado' && /^blob:/.test(await aT.urlModelo(mods[0])), 'y el vídeo modelo de la sentadilla (con su enlace)');
  // 14. Recordatorios: el coach, como mucho 3 activos; Ana, los suyos sin horas; Rubén, ninguno de Ana
  const diarioAna = await aT.diario(ana.id);
  const vCorr = diarioAna.find((a) => a.tipo === 'video_tecnica' && a.revision?.corregido_el && a.ejercicio?.id === sent.id);
  const r1 = await aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: '  Rodillas   hacia fuera ', archivoId: vCorr.id, segundo: 2 });
  await aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: 'Pecho arriba' });
  await aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: 'Aire antes de bajar' });
  check(r1.texto === 'Rodillas hacia fuera' && await lanza(() => aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: 'El cuarto' })), 'el coach fija hasta 3 (sin espacios de más)');
  const vRuben = (await aT.diario(ruben.id)).find((a) => a.tipo === 'video_tecnica');
  check(await lanza(() => bT.insert('recordatorios_tecnica', [{ atleta_id: ana.id, ejercicio_id: sent.id, texto: 'Con el de Rubén', archivo_id: vRuben.id, activo: false }]))
    && await lanza(() => bT.insert('recordatorios_tecnica', [{ atleta_id: ana.id, ejercicio_id: sent.id, texto: 'Momento sin vídeo', segundo: 2, activo: false }]))
    && await lanza(() => bT.insert('recordatorios_tecnica', [{ atleta_id: ana.id, ejercicio_id: sent.id, texto: 'x'.repeat(141), activo: false }]))
    && await lanza(() => bT.update('recordatorios_tecnica', { atleta_id: ruben.id }, { eq: { id: r1.id } })), 'con las mismas reglas: su vídeo, de ese atleta; un momento, con su vídeo; hasta 140; no cambia de atleta');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const recA = await aT.recordatoriosActivos(ana.id);
  check(recA.length === 3 && recA.every((r) => !Object.keys(r).some((k) => /_en$/.test(k))) && recA.find((r) => r.id === r1.id).archivo_id === vCorr.id && !(await bT.select('recordatorios_tecnica', {})).length
    && await lanza(() => aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: 'Mío' })) && !(await bT.update('recordatorios_tecnica', { texto: 'x' }, { eq: { id: r1.id } })).length,
    'Ana ve sus 3 (sin horas, con el vídeo corregido), nunca la tabla, y no los escribe');
  // 12. Su valoración al enviar un vídeo
  const v = await aT.subirArchivo(ana.id, new File([new Uint8Array(500)], 'serie.mp4', { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 6,
    autoevaluacion: limpiarAutoevaluacion({ rpe: 9, nota: 'Me cuesta', molestia: true, zona: 'rodilla' }, { salud: true }) });
  check(v.autoevaluacion?.zona === 'rodilla' && v.autoevaluacion.atleta_id === ana.id, 'Ana envía un vídeo con su valoración (con una molestia en la rodilla)');
  check(await lanza(() => bT.upsert('video_autoevaluacion', [{ archivo_id: v.id, rpe: 5.5 }], 'archivo_id')) && await lanza(() => bT.upsert('video_autoevaluacion', [{ archivo_id: v.id, nota: 'x'.repeat(281) }], 'archivo_id'))
    && await lanza(() => bT.upsert('video_autoevaluacion', [{ archivo_id: v.id, molestia: true, zona: 'pie' }], 'archivo_id')), 'con las mismas reglas que la base');
  const c = await bT.select('consentimientos', {});
  for (const x of c.filter((x) => x.tipo === 'datos_salud')) await bT.update('consentimientos', { revocado_en: new Date().toISOString() }, { eq: { id: x.id } });
  const v2 = await aT.subirArchivo(ana.id, new File([new Uint8Array(500)], 's2.mp4', { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 6 });
  check(await lanza(() => bT.insert('video_autoevaluacion', [{ archivo_id: v2.id, molestia: false }])) && (await aT.guardarAutoevaluacion(v2, { rpe: 8 }, { salud: false }))?.rpe === 8,
    'sin consentimiento de datos de salud, la molestia no se guarda (el esfuerzo, sí)');
  await bT.auth.entrar('ruben@fbe.demo', 'demo').catch(() => null);
  if ((await aT.perfil())?.rol === 'atleta') check(!(await bT.select('video_autoevaluacion', { eq: { archivo_id: v.id } })).length && !(await aT.recordatoriosActivos(ana.id)).length, 'Rubén no ve la valoración ni los recordatorios de Ana');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await aT.autoevaluacion(v.id))?.nota === 'Me cuesta' && await lanza(() => aT.guardarAutoevaluacion(v, { rpe: 6 })), 'el coach la lee pero no la cambia');
  await aT.marcarRevisado('archivo', v.id);
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  check(await lanza(() => aT.guardarAutoevaluacion(v, { rpe: 7 })), 'revisado el vídeo, Ana ya no la cambia');
  // 4. Frases, 6. vídeos modelo, 15. marcas a mano: del coach
  check(!(await aT.frasesCorreccion(sent.id)).length && await lanza(() => aT.guardarFrase({ texto: 'Mía' })) && await lanza(() => aT.subirVideoModelo(sent, new File([new Uint8Array(10)], 'm.mp4', { type: 'video/mp4' }))), 'Ana no tiene frases ni sube vídeos modelo');
  check((await aT.videosModelo([sent.id])).length === 1 && await lanza(() => bT.storage.subir(`modelos/${sent.id}/modelo-intruso12.mp4`, new Blob(['x']), 'video/mp4')), 've el modelo, pero no sube a modelos/');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const fs = await aT.guardarFrasesSugeridas(sent);
  check(fs.length >= 3 && await lanza(() => aT.guardarFrase({ texto: 'Mal dibujo', dibujo: { t: 0, formas: [] } })), 'el coach guarda sus frases (y no una con un dibujo mal formado)');
  const m2 = await aT.subirVideoModelo(sent, new File([new Uint8Array(1000)], 'demo.mp4', { type: 'video/mp4' }), { angulo: 'De frente' });
  check((await aT.videosModelo([sent.id])).length === 2 && /^modelos\//.test(m2.ruta), 'y sube otro vídeo modelo');
  await aT.borrarVideoModelo(m2);
  check((await aT.videosModelo([sent.id])).length === 1 && !(await bT.select('videos_modelo', { eq: { id: m2.id } })).length, 'borrarlo lo quita (y a la cola de Storage, que vacía el coach)');
  check(igual(await aT.guardarRepsManual(v, [1, 3]), [1, 3]) && igual(await aT.repsManual(v.id), [1, 3]) && await lanza(() => aT.guardarRepsManual(v, [1, 9])), 'las marcas de repetición a mano, en orden y dentro del vídeo');
  const est = await aT.estadisticasRevision();
  check(est.pendientes >= 1 && est.masAntiguo != null && est.semana >= 1, `los tiempos de la cola en la demo (${est.pendientes} esperando, ${est.semana} revisados esta semana)`);
  // 7. Su mejor: el de mejor nota de ese ejercicio
  const mejor = await aT.mejorVideoDe({ ...vPend, ejercicio: sent });
  check(mejor && mejor.revision?.puntuacion === 4 && mejor.atleta_id === ana.id, '«Comparar con su mejor»: el de mejor nota de Ana en la sentadilla');
  // Pasar un vídeo a otro atleta: el hilo, la valoración y los recordatorios
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const seAnaD = (await bT.select('archivos', { eq: { atleta_id: ana.id } })).find((x) => x.sesion_ejercicio_id)?.sesion_ejercicio_id || null;
  const v3 = await aT.subirArchivo(ana.id, new File([new Uint8Array(500)], 's3.mp4', { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 6, nota_atleta: 'Me molesta la rodilla', sesion_ejercicio_id: seAnaD, autoevaluacion: { rpe: 8, nota: null, molestia: null, zona: null } });
  await bT.update('archivos', { destacado: true }, { eq: { id: v3.id } });
  await aT.comentar({ atletaId: ana.id, archivoId: v3.id, texto: '¿Qué tal?', autor: 'atleta' });
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  await aT.comentar({ atletaId: ana.id, archivoId: v3.id, texto: 'En 0:02, la espalda', autor: 'coach' });
  await aT.editarRecordatorio(r1.id, { activo: false });
  const rMov = await aT.fijarRecordatorio({ atletaId: ana.id, ejercicioId: sent.id, texto: 'Espalda neutra', archivoId: v3.id, segundo: 2 });
  await bT.update('archivos', { atleta_id: ruben.id }, { eq: { id: v3.id } });
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  check(!(await aT.comentarios({ atletaId: ana.id, archivoId: v3.id })).length && !(await aT.recordatoriosActivos(ana.id)).some((r) => r.id === rMov.id) && !(await bT.select('video_autoevaluacion', { eq: { archivo_id: v3.id } })).length,
    'pasado el vídeo a Rubén, Ana ya no ve su hilo, su valoración ni el recordatorio enlazado');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const hilo = await aT.comentarios({ atletaId: ruben.id, archivoId: v3.id });
  check(hilo.length === 1 && hilo[0].autor === 'coach' && hilo[0].atleta_id === ruben.id && (await aT.recordatoriosCoach(ruben.id, sent.id)).some((r) => r.id === rMov.id && r.activo), 'lo del coach (y el recordatorio) pasa a Rubén; lo de Ana se borra');
  const [v3M] = await bT.select('archivos', { eq: { id: v3.id } });
  check(!!seAnaD && v3M.atleta_id === ruben.id && v3M.nota_atleta === null && v3M.destacado === false && v3M.sesion_ejercicio_id === null && v3M.serie_numero == null,
    '(M1) del vídeo, ni el pie de Ana, ni su estrella, ni la serie de su sesión pasan a Rubén (como la 037)');
  // (revisión) L4: el mismo error para un vídeo de otro, algo que no es un vídeo de técnica o un id que no existe
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const errD = async (id) => { try { await bT.upsert('video_autoevaluacion', [{ archivo_id: id, rpe: 8 }], 'archivo_id'); return null; } catch (e) { return e.message; } };
  const fotoAna = (await bT.select('archivos', { eq: { atleta_id: ana.id } })).find((x) => x.tipo !== 'video_tecnica');
  const eL4 = [await errD(v3.id), await errD(crypto.randomUUID()), ...(fotoAna ? [await errD(fotoAna.id)] : [])];
  check(eL4.length === 3 && eL4.every((m) => m === eL4[0]) && /Solo valoras tus vídeos de técnica/.test(eL4[0] || ''), '(L4) el mismo error para el vídeo de Rubén, un id que no existe y algo que no es un vídeo de técnica');
  // (revisión) L1: cada cambio cuenta una vez y lo que no cambia nada, no (30 por hora)
  {
    const bL = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
    const aL = crearApi(bL);
    await bL.auth.entrar('ana@fbe.demo', 'demo');
    const anaL = (await bL.select('atletas', {}))[0].id;
    const sentL = (await aL.biblioteca()).find((e) => e.nombre === 'Sentadilla barra alta');
    const vL = await aL.subirArchivo(anaL, new File([new Uint8Array(300)], 'l1.mp4', { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sentL.id, duracion_seg: 6 });
    let n = 0, m = '';
    for (let i = 0; i < 31; i++) {
      try {
        await aL.guardarAutoevaluacion(vL, { rpe: i % 2 ? 7 : 8, nota: null, molestia: null, zona: null });
        n++;
        if (i < 5) await aL.guardarAutoevaluacion(vL, { rpe: i % 2 ? 7 : 8, nota: null, molestia: null, zona: null });
      } catch (e) { m = e.message; break; }
    }
    check(n === 30 && /valoración en la última hora/.test(m), `(L1) 30 cambios pasan y el 31.º no; guardar lo mismo no cuenta (${n})`);
  }
  // (revisión) M2: la versión de la política con su revisión, como la 037
  {
    const uid = bT.auth.sesion().user.id;
    const pv = async (v) => (await bT.upsert('privacidad_vista', [{ usuario_id: uid, version: v }], 'usuario_id'))[0].version;
    check(VERSION_LEGAL_D === '2026-12.21' && await aT.versionLegal() === '2026-12.21' && await pv('2026-12.21') === '2026-12.21' && await pv('2026-12.11') === '2026-12.21' && await pv('2026-12.9') === '2026-12.21' && await pv('2026-12') === '2026-12.21' && await pv('2026-11') === '2026-12.21',
      '(M2) en la demo (que tiene la 037, la 043, la 044, la 045 y la 050), la 2026-12.16 (v0.110); nunca hacia atrás, comparando por partes (.12 va después de .11 y de .9)');
    check(await lanza(() => pv('2026-12.0')) && await lanza(() => pv('2026-12.100')) && await lanza(() => pv('2026-12.01')) && await lanza(() => pv('2099-01.1')), '(M2) solo con su formato (revisión de 1 a 99) y de un mes que ya existe');
  }
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
}

// v0.60: los vídeos de técnica, tanda B (primera mitad) en la demo: las mismas reglas que la 038
console.log('\nv0.60: respuestas en vídeo, dos ángulos y cámara lenta en la demo (las mismas reglas que la 038)');
{
  const bT = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const aT = crearApi(bT);
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const atl = await aT.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López'), ruben = atl.find((a) => a.nombre === 'Rubén Martín');
  check(await aT.video038() === true, 'la demo tiene lo de la 038');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const v1 = await aT.subirArchivo(ana.id, new Blob(['a'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, fps_captura: 240 });
  const v2 = await aT.subirArchivo(ana.id, new Blob(['b'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, angulo_de: v1.id });
  const v3 = await aT.subirArchivo(ana.id, new Blob(['c'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6 });
  check(v1.fps_captura === 240 && v2.angulo_de === v1.id && (await aT.parejaAngulo(v1))?.id === v2.id && (await aT.parejaAngulo(v2))?.id === v1.id, '(11 y 9) el ritmo de la cámara lenta y el otro ángulo, al enviarlo');
  check(await lanza(() => aT.enlazarAngulo(v3, v1.id)) && await lanza(() => aT.enlazarAngulo(v3, v2.id)) && await lanza(() => aT.enlazarAngulo(v3, v3.id))
    && await lanza(() => bT.update('archivos', { fps_captura: 60 }, { eq: { id: v1.id } })), 'como mucho una pareja (ni un tercero, ni en cadena, ni consigo); el ritmo no se cambia');
  const cA = await aT.responderConVideo(v1, new Blob(['webm'], { type: 'video/webm' }), { autor: 'atleta', seg: 20 });
  check(cA?.video_respuesta_id && cA.autor === 'atleta' && await lanza(() => aT.responderConVideo(v1, new Blob(['x'], { type: 'video/mp4' }), { autor: 'atleta', seg: 70 })),
    '(2) Ana responde con la cámara de delante (y no más de un minuto)');
  // (como la 038, aunque la app no lo mande: una respuesta en vídeo de 70 s del atleta, en el chat o con el vídeo del coach, no)
  const largo = await aT.subirArchivo(ana.id, new File(['x'], 'r.mp4', { type: 'video/mp4' }), { tipo: 'adjunto', duracion_seg: 70 });
  check(await lanza(() => aT.comentar({ atletaId: ana.id, archivoId: v1.id, texto: 'x', autor: 'atleta', videoRespuestaId: largo.id }))
    && await lanza(() => aT.comentar({ atletaId: ana.id, texto: 'x', autor: 'atleta', videoRespuestaId: cA.video_respuesta_id }))
    && await lanza(() => aT.comentar({ atletaId: ana.id, archivoId: cA.video_respuesta_id, texto: 'x', autor: 'atleta' })), 'la demo comprueba lo mismo que la base (duración, el hilo de un vídeo, una vez)');
  check(await lanza(() => bT.update('comentarios', { video_respuesta_id: null }, { eq: { id: cA.id } })) && (await bT.delete('archivos', { eq: { id: cA.video_respuesta_id } }), !!(await aT.archivo(cA.video_respuesta_id))),
    'ni se cambia, ni Ana borra el vídeo de su mensaje');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const cR = await aT.responderConVideo(v1, new Blob(['mp4'], { type: 'video/mp4' }), { autor: 'coach', seg: 170, texto: 'Revisión grabada' });
  const vids = await aT.videosDeRespuestas(await aT.comentarios({ archivoId: v1.id }));
  check(vids[cR.id]?.duracion_seg === 170 && vids[cA.id]?.mime === 'video/webm', '(1) el coach manda su revisión grabada (2:50); el hilo trae los dos vídeos');
  const j = await aT.guardarDesfase(v1, v2.id, -0.25);
  check(j.desfase === -0.25 && Number((await aT.correccionesDe([v1.id]))[0]?.dos_angulos?.desfase) === -0.25 && (await aT.correccionesDe([v1.id]))[0].corregido_el === null
    && await lanza(() => aT.guardarDesfase(v1, v3.id, 0)) && await lanza(() => bT.upsert('video_revisiones', [{ archivo_id: v1.id, atleta_id: ana.id, dos_angulos: { con: v2.id, desfase: 2.5 } }], 'archivo_id')) && (await aT.guardarDesfase(v1, v2.id, 2.5)).desfase === 2, '(9) el desfase con la corrección (no cuenta como corregido), solo con su pareja y de −2 a +2 s');
  // Eliminar la respuesta se lleva su vídeo; pasar el vídeo a otro atleta, sus respuestas en vídeo y su pareja
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  await aT.eliminarMensaje(cA);
  check(!(await aT.archivo(cA.video_respuesta_id)), 'Ana elimina su respuesta: su vídeo se va con ella');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  await bT.update('archivos', { atleta_id: ruben.id, ruta: `${ruben.id}/${v1.ruta.split('/')[1]}` }, { eq: { id: v1.id } });
  check(!(await aT.archivo(cR.video_respuesta_id)) && (await aT.archivo(v2.id)).angulo_de === null && (await aT.correccionesDe([v1.id]))[0]?.dos_angulos == null,
    'pasar el vídeo a otro atleta borra sus respuestas en vídeo y lo desenlaza (y quita el desfase)');
  // (revisión) Como la 038: el tamaño, el de Storage (un vídeo registrado pero sin subir no vale)
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const [sinSubir] = await bT.insert('archivos', [{ atleta_id: ana.id, tipo: 'adjunto', ruta: `${ana.id}/adjunto-video-sinsubir.mp4`, mime: 'video/mp4', bytes: 100, duracion_seg: 5 }]);
  check(await lanza(() => aT.comentar({ atletaId: ana.id, archivoId: v3.id, texto: 'x', autor: 'atleta', videoRespuestaId: sinSubir.id })), '(M2) un vídeo de respuesta que no está en Storage no vale');
  // (L3) desenlazar quita el desfase; (L5) el coach elimina su respuesta (con la ruta) o borra su archivo (el mensaje, eliminado)
  const w1 = await aT.subirArchivo(ana.id, new Blob(['w1'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6 });
  const w2 = await aT.subirArchivo(ana.id, new Blob(['w2'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, angulo_de: w1.id });
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  await aT.guardarDesfase(w1, w2.id, 0.3);
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  await aT.desenlazarAngulo(w1);
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  check((await aT.correccionesDe([w1.id]))[0]?.dos_angulos == null, '(L3) al desenlazar dos ángulos, el desfase guardado se quita');
  const cE = await aT.responderConVideo(w1, new Blob(['mp4'], { type: 'video/mp4' }), { autor: 'coach', seg: 20 });
  const rE = await aT.archivo(cE.video_respuesta_id);
  const elE = await bT.rpc('comentario_eliminar', { p_comentario: cE.id });
  check(elE.rutas.includes(rE.ruta) && !(await aT.archivo(rE.id)), '(L5) el coach elimina su respuesta en vídeo: se le devuelve su ruta y su archivo se va');
  const cF = await aT.responderConVideo(w1, new Blob(['mp4'], { type: 'video/mp4' }), { autor: 'coach', seg: 20, texto: 'Mira' });
  await aT.borrarArchivo(await aT.archivo(cF.video_respuesta_id));
  const [cF2] = await bT.select('comentarios', { eq: { id: cF.id } });
  check(cF2.eliminado_en && cF2.texto === 'Se eliminó este mensaje' && !cF2.video_respuesta_id, '(L5) si el coach borra el archivo de una respuesta, su mensaje queda como eliminado');
  const cR2 = await aT.responderConVideo(v3, new Blob(['mp4'], { type: 'video/mp4' }), { autor: 'coach', seg: 30 });
  await aT.borrarArchivo(await aT.archivo(v3.id));
  check(!(await aT.archivo(cR2.video_respuesta_id)), 'y borrar un vídeo, sus respuestas en vídeo');
}

// (v0.58.1) El historial del chat por páginas en la demo, como en la base: para la atleta como para el coach
console.log('\nv0.58.1: el historial del chat por páginas en la demo');
{
  const semillaLarga = () => {
    const d = semillaDemo();
    const ana = d.atletas.find((a) => a.nombre.startsWith('Ana'));
    const t0 = Date.now() - 60 * 864e5;
    for (let i = 0; i < 650; i++) d.comentarios.push({ id: crypto.randomUUID(), atleta_id: ana.id, sesion_id: null, checkin_id: null, archivo_id: null, autor: i % 2 ? 'coach' : 'atleta', adjunto: false, dibujo: null, texto: `Antiguo ${i}`, creado_en: new Date(t0 + i * 3600e3).toISOString(), leido_en: null });
    return d;
  };
  const b7 = crearBackendMemoria({ semilla: semillaLarga, persistir: false });
  const a7 = crearApi(b7);
  await b7.auth.entrar('pelayo@fbe.demo', 'demo');
  const ana7 = (await a7.atletas()).find((a) => a.nombre.startsWith('Ana'));
  const deCoach = [];
  for (const limite of [400, 600, 1000]) deCoach.push((await a7.conversacion(ana7.id, { limite })).filter((c) => !c.programado).map((c) => c.id));
  await b7.auth.entrar('ana@fbe.demo', 'demo');
  const deAna = [];
  for (const limite of [400, 600, 1000]) deAna.push((await a7.conversacion(ana7.id, { limite })).map((c) => c.id));
  const total = deAna[2].length;
  check(deAna[0].length === 400 && deAna[1].length === 600 && deAna[1].slice(-400).join() === deAna[0].join() && total > 650 && total < 1000,
    `(v0.58.1) la atleta, de página en página: 400, 600 (los 200 anteriores encima) y hasta el primero (${total})`);
  check(deAna[2].join() === deCoach[2].join() && (await a7.conversacion(ana7.id, { limite: 1000 }))[0].texto === 'Antiguo 0', '(v0.58.1) lo mismo que ve el coach (sin lo programado), hasta el primer mensaje');
}

console.log('\nv0.61: revisar la sesión, la velocidad mínima y el informe del mes en la demo (las mismas reglas que la 039)');
{
  const SV = await import('../web/src/logica/sesionVideos.js');
  const IT = await import('../web/src/logica/informeTecnica.js');
  const bT = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const aT = crearApi(bT);
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const atl = await aT.atletas();
  const ana = atl.find((a) => a.nombre === 'Ana López');
  check(await aT.video039() === true, 'la demo tiene lo de la 039');
  // Una sesión hecha de Ana con dos ejercicios con series
  const bloques = await bT.select('bloques', { eq: { atleta_id: ana.id } });
  const semanas = await bT.select('semanas', { in: { bloque_id: bloques.map((x) => x.id) } });
  const sesiones = (await bT.select('sesiones', { in: { semana_id: semanas.map((w) => w.id) }, eq: { completada: true } }));
  let ses = null, ps = [];
  for (const s of sesiones) {
    const pp = (await bT.select('sesion_ejercicios', { eq: { sesion_id: s.id }, order: [['orden', 'asc']] }));
    const conSeries = [];
    for (const p of pp) if ((await bT.select('series', { eq: { sesion_ejercicio_id: p.id } })).length) conSeries.push(p);
    if (conSeries.length >= 2) { ses = s; ps = conSeries.slice(0, 2); break; }
  }
  check(!!ses, 'una sesión de Ana con dos ejercicios hechos');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const v2 = await aT.subirArchivo(ana.id, new Blob(['b'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, sesion_ejercicio_id: ps[1].id, ejercicio_id: ps[1].ejercicio_id, serie_numero: 1 });
  const v1 = await aT.subirArchivo(ana.id, new Blob(['a'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, sesion_ejercicio_id: ps[0].id, ejercicio_id: ps[0].ejercicio_id, serie_numero: 1 });
  check(await lanza(() => aT.guardarUmbralVelocidad(ps[0].ejercicio_id, 0.3)) && await lanza(() => bT.insert('umbrales_velocidad', [{ ejercicio_id: ps[0].ejercicio_id, vmin: 0.3 }])),
    'Ana no escribe la velocidad mínima (como la 039)');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  const band = await aT.bandeja();
  const mios = band.archivos.filter((a) => a.id === v1.id || a.id === v2.id);
  const ag = SV.agruparPorSesion(mios, Object.fromEntries(mios.map((a) => [a.sesion_ejercicio_id, a.pauta])));
  check(ag.grupos.length === 1 && ag.grupos[0].videos.map((v) => v.id).join() === `${v1.id},${v2.id}` && mios.every((a) => a.sesionVideo?.id === ses.id), '(5) en la bandeja, juntos y en el orden de la sesión');
  const pr = await aT.sesionParaRevisar(ses.id);
  check(pr.pautas.length >= 2 && pr.pautas[0].hechas.length > 0 && pr.resumen === null, 'con las series de la sesión');
  const normal = await aT.comentar({ atletaId: ana.id, sesionId: ses.id, texto: 'Resumen de la sesión (un mensaje normal)', autor: 'coach' });
  check(normal.resumen_sesion === false && (await aT.sesionParaRevisar(ses.id)).resumen === null, '(M2) un mensaje que empieza igual no es un resumen (como la 039)');
  const c = await aT.enviarResumenSesion({ atletaId: ana.id, sesionId: ses.id, texto: 'Resumen de la sesión: muy bien' });
  check(c?.sesion_id === ses.id && c.resumen_sesion === true && (await aT.sesionParaRevisar(ses.id)).resumen?.id === c.id && await lanza(() => aT.enviarResumenSesion({ atletaId: ana.id, sesionId: ses.id, texto: 'Otro' }))
    && await lanza(() => bT.insert('comentarios', [{ atleta_id: ana.id, sesion_id: ses.id, texto: 'Otro', resumen_sesion: true }])),
    'el resumen, en el hilo de la sesión, marcado y una vez (la demo lo impide como la base)');
  check(await lanza(() => bT.update('comentarios', { resumen_sesion: false }, { eq: { id: c.id } })) && await lanza(() => bT.update('comentarios', { resumen_sesion: true }, { eq: { id: normal.id } })), 'la marca no se cambia después');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  check(await lanza(() => bT.insert('comentarios', [{ atleta_id: ana.id, sesion_id: ps[0].sesion_id, texto: 'Resumen de la sesión', resumen_sesion: true }])), 'Ana no escribe un «resumen»');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  await bT.rpc('comentario_eliminar', { p_comentario: c.id });
  check((await bT.select('comentarios', { eq: { id: c.id } }))[0]?.resumen_sesion === false && !!(await aT.enviarResumenSesion({ atletaId: ana.id, sesionId: ses.id, texto: 'Resumen de la sesión: de nuevo' }))?.resumen_sesion,
    'eliminado para todos, deja de contar: la sesión admite otro');
  // 16. La velocidad mínima
  const ej = ps[0].ejercicio_id;
  check(await aT.guardarUmbralVelocidad(ej, 0.3) === 0.3 && await lanza(() => aT.guardarUmbralVelocidad(ej, 0.0499)) && await lanza(() => bT.upsert('umbrales_velocidad', [{ ejercicio_id: ej, vmin: 0.1234 }], 'ejercicio_id'))
    && await lanza(() => bT.update('umbrales_velocidad', { ejercicio_id: ps[1].ejercicio_id }, { eq: { ejercicio_id: ej } })), 'el coach la escribe; la demo rechaza lo mismo que la base (rango, decimales, cambiar de ejercicio)');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  check((await aT.umbralesVelocidad([ej]))[ej] === 0.3 && !(await bT.select('umbrales_velocidad', {})).length && await lanza(() => bT.rpc('umbrales_velocidad_de', { p_ejercicios: Array.from({ length: 201 }, () => ej) })),
    'Ana la lee con su función (no la tabla), como mucho 200 de una vez');
  await bT.auth.entrar('pelayo@fbe.demo', 'demo');
  await aT.guardarUmbralVelocidad(ej, null);
  check(!Object.keys(await aT.umbralesVelocidad([ej])).length, 'y la quita');
  // 17. El informe
  const mes = hoyISO().slice(0, 7);
  const ci = await aT.enviarInformeTecnica(ana.id, mes);
  check(IT.leerTarjetaInforme(ci) === mes && await aT.informeEnviado(ana.id, mes) && await lanza(() => aT.enviarInformeTecnica(ana.id, mes)), '(17) el informe, como una tarjeta del chat (una vez por mes)');
  await bT.auth.entrar('ana@fbe.demo', 'demo');
  const r = await aT.informeTecnica(ana.id, mes);
  check(r.informe.enviados >= 2 && (await aT.conversacion(ana.id)).some((x) => x.id === ci.id), 'Ana lo ve en su chat y lo abre');
}

console.log('\nv0.69: la comunidad, primera tanda (las mismas reglas de la 041 en la demo)');
{
  const b3 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a3 = crearApi(b3);
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  const nuevos = await a3.nuevosComunidad();
  check(nuevos.length === 1 && nuevos[0].nombre === 'Lucía F.' && !nuevos[0].bienvenida && await a3.comunidad041() === true, 'Carlos ve que Lucía acaba de entrar (la demo tiene la 041)');
  await a3.darBienvenida(nuevos[0].perfil_id);
  check((await a3.nuevosComunidad())[0].bienvenida && await lanza(() => a3.darBienvenida(nuevos[0].perfil_id)) && await lanza(() => a3.darBienvenida(a3.uid()))
    && await lanza(() => b3.insert('comunidad_bienvenidas', [{ de: a3.uid(), para: nuevos[0].perfil_id }])), 'le da la bienvenida una vez; ni a sí mismo ni a mano');
  await b3.auth.entrar('lucia@fbe.demo', 'demo');
  check((await a3.nuevosComunidad()).length === 0 && (await a3.bienvenidasRecibidas()).map((x) => x.nombre).sort().join() === 'Carlos V.,Rubén M.', 'Lucía no se ve a sí misma; ve quién le ha dado la bienvenida');
  const post = (await a3.muro()).posts.find((x) => x.mio && x.tipo === 'post');
  const coms = await a3.comentariosComunidad(post.id);
  const deRuben = coms.find((c) => c.autor.nombre === 'Rubén M.');
  check(deRuben.fuerza.join() === 'Pelayo' && coms.every((c) => c.con041), 'el comentario de Rubén en su publicación ya tiene el 💪 del coach');
  await a3.comentarEnComunidad(post.id, '¡Gracias!', [], deRuben.id);
  const otro = (await a3.muro()).posts.find((x) => !x.mio && x.comentarios > 0 && x.id !== post.id);
  const ajeno = otro && (await a3.comentariosComunidad(otro.id))[0];
  check(await lanza(() => a3.comentarEnComunidad(post.id, 'x', [], ajeno?.id || 'nada')), 'responder a un comentario de otra publicación, no (como la base)');
  const resp = (await a3.comentariosComunidad(post.id)).find((c) => c.texto === '¡Gracias!');
  await a3.comentarEnComunidad(post.id, 'Y otra', [], resp.id);
  check(resp.responde_a === deRuben.id && (await a3.comentariosComunidad(post.id)).find((c) => c.texto === 'Y otra').responde_a === deRuben.id, 'responde a Rubén; a una respuesta, cuelga del mismo comentario');
  check(await a3.reaccionarComentario(deRuben.id) === true && await a3.reaccionarComentario(deRuben.id) === false, '💪 a un comentario: otra vez lo quita');
  // Entrenando ahora: Lucía lo enciende y apunta una serie de una sesión sin terminar (en la demo no entrena: se finge)
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  check(await lanza(() => b3.insert('comunidad_comentario_reacciones', [{ comentario_id: deRuben.id, autor_id: a3.uid() }])), 'los 💪 no se escriben a mano');
  await a3.verEntrenandoComunidad(true);
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  check((await a3.entrenandoAhora()).length === 0, 'nadie entrenando: Rubén lo ha encendido, pero no ha apuntado nada en los últimos 20 minutos');
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  const misBloques = (await b3.select('bloques', { eq: { atleta_id: (await a3.miAtleta()).id, es_plantilla: false } })).map((x) => x.id);
  const misSemanas = (await b3.select('semanas', { in: { bloque_id: misBloques } })).map((x) => x.id);
  const sinHacer = (await b3.select('sesiones', { in: { semana_id: misSemanas } })).find((x) => !x.completada);
  const pauta = sinHacer && (await b3.select('sesion_ejercicios', { eq: { sesion_id: sinHacer.id } }))[0];
  if (pauta) await b3.insert('series', [{ sesion_ejercicio_id: pauta.id, numero: 20, kg: 40, reps: 8 }]);
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  const ahora = await a3.entrenandoAhora();
  check(!!pauta && ahora.length === 1 && ahora[0].nombre === 'Rubén M.' && Object.keys(ahora[0]).sort().join() === 'foto,nombre,perfil_id', 'Rubén apunta una serie: Carlos le ve «entrenando ahora» (solo su nombre y su foto)');
  await b3.auth.entrar('ruben@fbe.demo', 'demo');
  await a3.verEntrenandoComunidad(false);
  await b3.auth.entrar('carlos@fbe.demo', 'demo');
  check((await a3.entrenandoAhora()).length === 0, 'al apagarlo, ya no sale');
  const datos = await b3.rpc('comunidad_mis_datos', {});
  check(Array.isArray(datos.bienvenidas_dadas) && datos.bienvenidas_dadas.length === 1 && Array.isArray(datos.reacciones_comentarios), '«Descargar mis datos» lleva sus bienvenidas y sus 💪 a comentarios');
}

console.log('\nv0.70: la comunidad, segunda tanda (las mismas reglas de la 042 en la demo)');
{
  const b4 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a4 = crearApi(b4);
  await b4.auth.entrar('ruben@fbe.demo', 'demo');
  const cp = await a4.companerosComunidad();
  check(await a4.comunidad042() === true && cp.length === 1 && cp[0].nombre === 'Carlos V.' && cp[0].estado === 'aceptada' && Number.isInteger(cp[0].racha) && 'mi_semana' in cp[0],
    'Rubén y Carlos son compañeros de racha en la demo (con su racha y cómo va la semana de cada uno)');
  const lucia = Object.entries(await a4.personasComunidad()).find(([, x]) => x.nombre === 'Lucía F.')[0];
  const id = await a4.invitarCompanero(lucia);
  check(await lanza(() => a4.invitarCompanero(lucia)) && await lanza(() => a4.invitarCompanero(a4.uid())) && await lanza(() => b4.insert('comunidad_companeros', [{ de: a4.uid(), para: lucia }])),
    'invita a Lucía (una vez; ni a sí mismo ni a mano)');
  await b4.auth.entrar('lucia@fbe.demo', 'demo');
  check((await a4.companerosComunidad()).some((x) => x.id === id && x.estado === 'pendiente' && !x.invito) && await a4.responderCompanero(id, true) === true
    && (await a4.companerosComunidad()).find((x) => x.id === id).estado === 'aceptada', 'Lucía la ve y acepta');
  const retos = await a4.retosComunidad();
  const rq = retos.find((r) => r.modo === 'equipos');
  const rc = retos.find((r) => r.medida === 'cardio');
  check(rq?.equiposReto.length === 2 && rq.equiposReto[1].mio && rq.equiposReto.map((e) => e.nombre).join() === 'Rojos,Azules' && rc?.total > 0 && rc.progreso.every((x) => x.yo || x.nombre === 'Carlos V.'),
    'un reto por equipos (Lucía en Azules) y uno de cardio que solo cuenta a quien cuenta sus minutos (Carlos)');
  const ins = await a4.insigniasComunidad(a4.uid());
  check(ins[a4.uid()]?.length === 10 && ins[a4.uid()].find((x) => x.clave === 'primera_publicacion').conseguida, 'sus insignias (diez con las sociales de la 053; con la de la primera publicación)');
  await a4.ajustesComunidad({ sinRanking: true });
  await b4.auth.entrar('carlos@fbe.demo', 'demo');
  check(!Object.keys(await a4.insigniasComunidad(lucia)).length && !(await a4.companerosComunidad(lucia)).length && (await a4.companerosComunidad()).length === 1,
    'de quien no sale en el ranking, ni insignias ni parejas para los demás (las suyas con él, sí)');
  await b4.auth.entrar('pelayo@fbe.demo', 'demo');
  const rec = await a4.recientesComunidad();
  check(rec.length >= 3 && rec.every((x) => Number.isInteger(x.sesiones)) && (await a4.equiposDeReto(rq.id)).b.length === 2, 'el coach: sesiones recientes de cada uno y el reparto de los equipos');
}

console.log('\nv0.71: la comunidad, tercera tanda (las mismas reglas de la 043 en la demo)');
{
  const b5 = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
  const a5 = crearApi(b5);
  await b5.auth.entrar('lucia@fbe.demo', 'demo');
  const muro = await a5.muro();
  check(await a5.comunidad043() === true && muro.con043 && muro.posts.every((x) => (x.tipo === 'entreno' ? x.tema == null : !!x.tema))
    && muro.posts.some((x) => x.tema === 'pregunta' && x.respondidaCoach) && muro.posts.some((x) => x.tema === 'tecnica'),
    'la demo tiene la 043: cada publicación con su tema (los entrenos, sin), un truco de técnica y una pregunta ya respondida por el coach');
  const preg = await a5.muro({ filtro: 'preguntas' }), tec = await a5.muro({ filtro: 'tecnica' }), avisos = await a5.muro({ filtro: 'avisos' }), logros = await a5.muro({ filtro: 'logros' });
  check(preg.posts.length === 1 && tec.posts.length === 1 && avisos.posts.every((x) => ['aviso', 'encuesta'].includes(x.tipo)) && avisos.posts.length === 2 && logros.posts.every((x) => x.tema === 'logros'),
    'los filtros de los temas (preguntas, técnica, avisos —también la encuesta— y logros), en la propia consulta');
  check(await lanza(() => b5.insert('comunidad_posts', [{ texto: 'Aviso falso', tema: 'avisos' }])), 'un atleta no publica con «Avisos»');
  const pq = await a5.publicarEnComunidad({ texto: '¿Cuánto descanso entre series de sentadilla?', tema: 'pregunta' });
  const jpg = () => new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' });
  const pf = await a5.publicarEnComunidad({ texto: 'Dos fotos del gimnasio', fotos: [jpg(), jpg()], tema: 'charla' });
  check(pq.tema === 'pregunta' && pf.fotos?.length === 2 && pf.fotos[0] === pf.foto_ruta && (await a5.muro()).posts.find((x) => x.id === pf.id)?.fotos.length === 2,
    'Lucía pregunta al coach y publica dos fotos (la primera es foto_ruta)');
  check(await lanza(() => a5.publicarEnComunidad({ texto: 'Cinco', fotos: [jpg(), jpg(), jpg(), jpg(), jpg()] }))
    && await lanza(() => b5.insert('comunidad_posts', [{ texto: 'x', foto_ruta: pf.foto_ruta, fotos: [pf.foto_ruta, 'coach/abcdefgh.jpg'] }])), 'como mucho 4, y todas en su carpeta');
  const idTec = tec.posts[0].id;
  check(await a5.guardarPost(idTec) === true && (await a5.muro({ filtro: 'guardados' })).posts.map((x) => x.id).join() === idTec && (await a5.muro()).posts.find((x) => x.id === idTec).guardado
    && await lanza(() => b5.insert('comunidad_guardados', [{ perfil_id: a5.uid(), post_id: pf.id }])), 'guarda el truco de Rubén: sale en «Guardados» (y no se escribe a mano)');
  const r1 = await a5.muro({ buscar: 'PRESS banca' }), r2 = await a5.muro({ buscar: 'ruben' }), r3 = await a5.muro({ buscar: 'press', filtro: 'guardados' }), r4 = await a5.muro({ buscar: 'x' });
  check(r1.posts.map((x) => x.id).join() === idTec && r2.posts.length >= 2 && r2.posts.every((x) => x.autor.nombre === 'Rubén M.') && r3.posts.length === 1 && r4.posts.length > 2,
    'buscar por el texto o el nombre (sin mayúsculas ni tildes), también dentro de un filtro; con una letra, no busca');
  const pL = muro.posts.find((x) => x.autor.nombre === 'Lucía F.' && x.tipo === 'post');
  const comL = await a5.comentariosComunidad(pL.id);
  const deCarlos = comL.find((c) => c.autor.nombre === 'Carlos V.');
  check(!!pL.mejor_comentario && comL.find((c) => c.id === pL.mejor_comentario)?.autor.nombre === 'Rubén M.' && await a5.mejorRespuesta(pL.id, deCarlos.id) === deCarlos.id
    && (await a5.muro()).posts.find((x) => x.id === pL.id).mejor_comentario === deCarlos.id, 'en su publicación, la mejor respuesta era la de Rubén; Lucía la cambia por la de Carlos');
  await b5.auth.entrar('carlos@fbe.demo', 'demo');
  check(await lanza(() => a5.mejorRespuesta(pL.id, null)) && !(await b5.select('comunidad_guardados', {})).length && (await a5.preguntasEquipo()).length === 1,
    'Carlos no la toca ni ve lo que ha guardado Lucía; ve la pregunta del equipo que guardó el coach');
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  const resp = await a5.comentarEnComunidad(pq.id, 'Entre 2 y 3 minutos en las series pesadas.');
  check(await lanza(() => a5.guardarPreguntaFrecuente({ postId: pf.id, comentarioId: resp.id })) && !(await b5.select('comunidad_guardados', {})).length, 'el coach: solo preguntas para el coach (y tampoco ve lo guardado)');
  await a5.guardarPreguntaFrecuente({ postId: pq.id, comentarioId: resp.id, pregunta: '¿Cuánto descanso entre series pesadas?' });
  const faqs = await a5.preguntasEquipo();
  check(faqs.length === 2 && faqs[0].pregunta === '¿Cuánto descanso entre series pesadas?' && faqs[0].respuesta === 'Entre 2 y 3 minutos en las series pesadas.'
    && (await a5.muro({ filtro: 'preguntas' })).posts.find((x) => x.id === pq.id)?.respondidaCoach, 'guarda la de Lucía como pregunta frecuente (retocada): su respuesta queda como «Respuesta del coach»');
  await b5.auth.entrar('carlos@fbe.demo', 'demo');
  await a5.avisarAlCoach({ postId: pf.id, motivo: 'Prueba' });
  await b5.auth.entrar('lucia@fbe.demo', 'demo');
  check(await lanza(() => b5.insert('comunidad_posts', [{ texto: 'Repetida', foto_ruta: pf.fotos[1].replace(/[A-Za-z0-9]+\.jpg$/, 'otraFoto1.jpg'), fotos: [pf.fotos[1].replace(/[A-Za-z0-9]+\.jpg$/, 'otraFoto1.jpg'), pf.fotos[1]] }])),
    '(revisión) una foto, en una sola publicación');
  const datos = await b5.rpc('comunidad_mis_datos', {});
  check(datos.guardados.length === 1 && datos.preguntas_frecuentes.length === 1, '«Descargar mis datos» lleva lo guardado y las preguntas frecuentes de sus preguntas');
  const fotos = await b5.rpc('comunidad_salir', { p_borrar: true });
  await b5.auth.entrar('pelayo@fbe.demo', 'demo');
  const rep = (await a5.reportesComunidad()).find((r) => r.post_id === null && r.copia_texto === 'Dos fotos del gimnasio');
  check(fotos.length === 0 && rep?.fotos.length === 2 && rep.borrado && (await a5.preguntasEquipo()).length === 1,
    'al salir borrando lo suyo, su pregunta frecuente se va; las dos fotos de lo avisado se quedan (el coach las ve en Revisar) hasta resolver el aviso');
}

console.log('\nv0.72: la comunidad, cuarta tanda (las mismas reglas de la 044 en la demo)');
{
  // (la semilla de siempre, con un aviso del coach que «salió» hace un minuto y otro que sale dentro de una hora)
  const semilla = () => {
    const db = semillaDemo();
    const coach = db.perfiles.find((p) => p.rol === 'coach').id;
    const base = { autor_id: coach, atleta_id: null, tipo: 'aviso', foto_ruta: null, sesion_id: null, resumen: null, fijada: false, oculta: false, menciones: [], encuesta: null, reto_id: null, tema: 'avisos', fotos: null, mejor_comentario: null, retenida: false };
    const ya = new Date(Date.now() - 60000).toISOString(), luego = new Date(Date.now() + 3600e3).toISOString();
    db.comunidad_posts.push({ ...base, id: crypto.randomUUID(), texto: 'Ya salió zz044', publicar_en: ya, creado_en: ya }, { ...base, id: crypto.randomUUID(), texto: 'Sale luego zz044', publicar_en: luego, creado_en: luego });
    return db;
  };
  const b6 = crearBackendMemoria({ semilla, persistir: false });
  const a6 = crearApi(b6);
  await b6.auth.entrar('lucia@fbe.demo', 'demo');
  const lucia = a6.uid();
  const muro = await a6.muro();
  check(await a6.comunidad044() === true && await a6.versionLegal() === '2026-12.21' && muro.posts.some((x) => x.texto === 'Ya salió zz044') && !muro.posts.some((x) => x.texto === 'Sale luego zz044')
    && !(await a6.muro({ buscar: 'luego zz044' })).posts.length, 'la demo tiene la 044: lo programado no se ve hasta su hora (ni buscándolo); lo que ya ha salido, sí');
  const [ev] = await a6.eventosComunidad();
  check(ev?.titulo === 'Quedada en el parque: circuito y café' && ev.van.join() === 'Rubén M.' && ev.noVan.join() === 'Carlos V.' && ev.miRespuesta === null && ev.plazas === 12,
    'una quedada del coach: Rubén va y Carlos no (12 plazas)');
  check(await a6.responderEvento(ev.id, true) === true && (await a6.eventosComunidad())[0].van.join() === 'Rubén M.,Lucía F.' && await a6.responderEvento(ev.id, null) === null
    && await lanza(() => b6.insert('comunidad_evento_asistentes', [{ evento_id: ev.id, perfil_id: lucia, va: true }])) && await lanza(() => b6.insert('comunidad_eventos', [{ titulo: 'Mío', empieza_en: new Date(Date.now() + 864e5).toISOString(), lugar: 'Casa' }])),
    'Lucía se apunta y se quita (no a mano); no crea eventos');
  check(await lanza(() => a6.panelComunidad()) && (await a6.plantillasComunidad()).length === 0 && await lanza(() => a6.guardarPlantilla('x')) && await lanza(() => a6.silenciarComunidad(lucia, 24)),
    'ni el panel, ni las plantillas, ni silenciar');
  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  await b6.update('comunidad_eventos', { plazas: 1 }, { eq: { id: ev.id } });
  const nuevo = await a6.guardarEvento({ titulo: 'Charla online', fecha: sumarDias(hoyISO(), 2), hora: '19:30', lugar: 'https://meet.example/fbe' });
  check((await a6.eventosComunidad()).length === 2 && nuevo.plazas === null && await lanza(() => a6.guardarEvento({ titulo: 'Ayer', fecha: sumarDias(hoyISO(), -1), hora: '10:00', lugar: 'Retiro' })), 'el coach crea otro (con un enlace) y no en el pasado');
  check((await a6.programadosComunidad()).map((x) => x.texto).join() === 'Sale luego zz044' && !(await a6.muro()).posts.some((x) => x.texto === 'Sale luego zz044'), 'el coach lo ve en «Programados» (no en el muro)');
  for (let i = 0; i < 30; i++) await a6.guardarPlantilla(`Plantilla ${i}`);
  check((await a6.plantillasComunidad()).length === 30 && await lanza(() => b6.insert('comunidad_plantillas', [{ texto: 'La 31' }])), 'hasta 30 plantillas');
  const panel = await a6.panelComunidad();
  check(panel.semanas.length === 4 && panel.miembros === 3 && panel.nunca.some((x) => x.nombre === 'Ana López') && panel.activos.length > 0 && !/texto/.test(JSON.stringify(panel)), 'el panel: recuentos, quién no ha entrado (Ana) y los más activos');
  await b6.auth.entrar('carlos@fbe.demo', 'demo');
  check(await lanza(() => a6.responderEvento(ev.id, true)), 'con la plaza ocupada por Rubén, Carlos no se apunta');
  await a6.ajustesComunidad({ sinRanking: true });
  const carlos = a6.uid();
  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  check(await lanza(() => a6.destacarAtleta(carlos, 'Por volver')), 'quien no sale en el ranking no puede ser el atleta de la semana');
  await a6.destacarAtleta(lucia, 'Por no fallar ni un día');
  await a6.cancelarEvento(nuevo.id);
  await a6.guardarModeracion({ palabras: 'Tonto\nmala palabra', lento: 10 });
  await a6.silenciarComunidad(carlos, 168);
  await b6.auth.entrar('carlos@fbe.demo', 'demo');
  check(await lanza(() => a6.publicarEnComunidad({ texto: 'Hola' })) && await lanza(() => a6.comentarEnComunidad(muro.posts[0].id, 'Hola')) && (await a6.reaccionar(muro.posts[0].id, 'fuerza')) === 'fuerza'
    && !!(await a6.miembroComunidad()).silenciado_hasta, 'Carlos, silenciado 7 días: lee y reacciona, pero no publica ni comenta');
  check((await a6.destacadoComunidad()).actual?.nombre === 'Lucía F.' && (await a6.eventosComunidad()).find((x) => x.id === nuevo.id)?.cancelado_en, 've a Lucía como atleta de la semana y el evento cancelado');
  await b6.auth.entrar('lucia@fbe.demo', 'demo');
  const r1 = await a6.publicarEnComunidad({ texto: 'Qué TONTO soy' });
  check(r1.retenida === true && await lanza(() => a6.publicarEnComunidad({ texto: 'Otra seguida' })) && (await a6.comentarEnComunidad(muro.posts[0].id, 'Una mala palabra')).retenido === true
    && await lanza(() => a6.responderEvento(nuevo.id, true)), 'Lucía: con una palabra filtrada, retenida; con el modo lento, no publica otra seguida; su comentario también se retiene; al evento cancelado no se apunta');
  await b6.auth.entrar('ruben@fbe.demo', 'demo');
  check(!(await a6.muro()).posts.some((x) => x.id === r1.id) && !(await a6.comentariosComunidad(muro.posts[0].id)).some((c) => c.retenido), 'Rubén no ve lo retenido');
  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  const ret = await a6.retenidosComunidad();
  check(ret.length === 2 && ret.every((x) => x.autor === 'Lucía F.'), 'el coach tiene los dos en «Pendiente de revisión»');
  for (const x of ret) await a6.aprobarComunidad(x.clase === 'post' ? { postId: x.id } : { comentarioId: x.id });
  await b6.auth.entrar('ruben@fbe.demo', 'demo');
  check((await a6.muro()).posts.some((x) => x.id === r1.id) && (await a6.comentariosComunidad(muro.posts[0].id)).some((c) => c.texto === 'Una mala palabra'), 'aprobados: ya los ve Rubén');
  await b6.auth.entrar('lucia@fbe.demo', 'demo');
  await a6.responderEvento(ev.id, false);
  const datos = await b6.rpc('comunidad_mis_datos', {});
  check(datos.eventos.length === 1 && datos.eventos[0].va === false && datos.atleta_de_la_semana.length === 1, '«Descargar mis datos» lleva sus respuestas a los eventos y cuándo fue atleta de la semana');
  await b6.rpc('comunidad_salir', { p_borrar: true });
  await b6.auth.entrar('pelayo@fbe.demo', 'demo');
  check(!(await b6.select('comunidad_evento_asistentes', {})).some((x) => x.perfil_id === lucia) && !(await a6.destacadoComunidad()).actual, 'al salir borrando lo suyo, sus respuestas se van; y el atleta de la semana deja de verse');
}

console.log('\nv0.73: la comunidad, quinta tanda (las mismas reglas de la 045 en la demo)');
{
  const C = await import('../web/src/logica/celebracion.js');
  const { fechaMadrid } = await import('../web/src/logica/fechas.js');
  const hoy = fechaMadrid();
  const alta = [1, 12, 24].map((n) => C.sumarMesesFecha(hoy, -n)).find((a) => C.aniversarioDe(a, hoy));
  // (Lucía cumple hoy su aniversario; Rubén tiene un momento de hace 25 horas y Carlos uno de hace una hora)
  const semilla = () => {
    const db = semillaDemo();
    const lucia = db.atletas.find((a) => a.nombre === 'Lucía Ferrer');
    lucia.fecha_alta = alta;
    const mom = (nombre, horas, foto) => {
      const a = db.atletas.find((x) => x.nombre.startsWith(nombre));
      db.comunidad_posts.push({ id: crypto.randomUUID(), autor_id: a.perfil_id, atleta_id: a.id, tipo: 'momento', texto: `Momento de ${nombre}`, foto_ruta: `${a.id}/${foto}.jpg`, sesion_id: null, resumen: null,
        fijada: false, oculta: false, creado_en: new Date(Date.now() - horas * 3600e3).toISOString(), menciones: [], encuesta: null, reto_id: null, tema: null, fotos: null, mejor_comentario: null, publicar_en: null, retenida: false });
    };
    mom('Rubén', 25, 'MomentoViejo1');
    mom('Carlos', 1, 'MomentoNuevo1');
    return db;
  };
  const b7 = crearBackendMemoria({ semilla, persistir: false });
  const a7 = crearApi(b7);
  await b7.auth.entrar('lucia@fbe.demo', 'demo');
  const muro = await a7.muro();
  await a7.muro();
  const anis = muro.posts.filter((x) => x.tipo === 'aniversario');
  check(!!alta && anis.length === 1 && anis[0].mio && anis[0].resumen.meses === C.mesesCumplidos(alta, hoy) && (await a7.muro()).posts.filter((x) => x.tipo === 'aniversario').length === 1,
    'el día de su aniversario, la demo pone en el muro, una vez, «Lucía F. cumple … en FBE» (como crear_recordatorios)');
  const ms = await a7.momentosComunidad();
  check(ms.map((x) => x.texto).join() === 'Momento de Carlos' && !muro.posts.some((x) => x.tipo === 'momento') && await lanza(() => a7.comentarEnComunidad(ms[0].id, 'Hola')),
    'los momentos: el de hace una hora, en su tira (no en el muro, ni se comenta); el de hace 25 horas, ya no');
  await b7.auth.entrar('pelayo@fbe.demo', 'demo');
  check(!(await b7.select('comunidad_posts', { eq: { tipo: 'momento' } })).some((x) => x.texto === 'Momento de Rubén')
    && (await b7.rpc('storage_pendiente_cubos', { p_limite: 100 })).some((x) => x.bucket === 'comunidad' && /MomentoViejo1/.test(x.ruta)),
    'el caducado se borra y su foto va a la cola de Storage del bucket «comunidad» (la vacía el coach)');
  await b7.auth.entrar('ruben@fbe.demo', 'demo');
  check(await a7.reaccionar(anis[0].id, 'trofeo') === 'trofeo' && (await a7.pegatinaEnComunidad(anis[0].id, 'constancia')).texto === 'Constancia'
    && (await a7.comentariosComunidad(anis[0].id)).some((c) => c.pegatina === 'constancia') && await lanza(() => a7.reaccionar(anis[0].id, 'pulgar')),
    'Rubén felicita a Lucía: 🏆 y la pegatina «Constancia» (una reacción que no existe, no)');
  await b7.auth.entrar('lucia@fbe.demo', 'demo');
  await a7.borrarDeComunidad(anis[0]);
  check(!(await a7.muro()).posts.some((x) => x.tipo === 'aniversario'), 'si Lucía lo borra, no vuelve a salir');
  await b7.auth.entrar('pelayo@fbe.demo', 'demo');
  await a7.guardarModeracion({ palabras: 'agujetazo', lento: 0 });
  await b7.auth.entrar('lucia@fbe.demo', 'demo');
  const mL = await a7.publicarMomento({ foto: new Blob(['x'], { type: 'image/jpeg' }), texto: 'Menudo agujetazo' });
  check(mL.retenida === true && (await a7.momentosComunidad()).some((x) => x.id === mL.id && x.mio && x.retenida), 'su momento con una palabra filtrada queda retenido (ella lo ve primero, pendiente)');
  await b7.auth.entrar('ruben@fbe.demo', 'demo');
  check(!(await a7.momentosComunidad()).some((x) => x.id === mL.id), 'Rubén no lo ve');
  const mes = await a7.mesEquipoComunidad();
  const hitos = await a7.hitosComunidad();
  check(/^\d{4}-\d{2}$/.test(mes.mes) && mes.equipo.miembros === 3 && mes.yo && Number.isInteger(mes.yo.sesiones) && hitos.length === 8, 'el mes en el equipo (del equipo y el de Rubén) y los hitos');
  await a7.ajustesComunidad({ sinRanking: true });
  check((await a7.mesEquipoComunidad()).equipo.miembros === 2 && (await a7.hitosComunidad()).find((x) => x.clave === 'sesiones_100').valor <= hitos.find((x) => x.clave === 'sesiones_100').valor
    && !!(await a7.mesEquipoComunidad()).yo, 'con «No salir en el ranking», lo suyo no cuenta en el equipo ni en los hitos (lo suyo lo sigue viendo)');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
