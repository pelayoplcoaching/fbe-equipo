// La demo (backend en memoria + datos de ejemplo) responde igual que la app real a las mismas funciones.
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const igualD = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.stack); process.exit(1); });

const b = crearBackendMemoria({ semilla: () => semillaDemo(), persistir: false });
const api = crearApi(b);

console.log('Coach en la demo');
await b.auth.entrar('pelayo@fbe.demo', 'demo');
check((await api.perfil()).rol === 'coach', 'entra como coach');
const res = await api.resumenes();
check(res.length === 4, '4 atletas en el panel');
for (const r of res) console.log('    ', r.nombre.padEnd(14), r.semana ? `S${r.semana.numero}/${r.semana.total}` : '—', `${r.sesiones.completadas}/${r.sesiones.total}`, r.peso ? `${r.peso.kg} (${r.peso.cambio})` : '', '|', r.alertas.map((a) => a.texto).join(' · '));
check(res.find((r) => r.nombre === 'Carlos Vera').alertas.some((a) => a.tipo === 'sin_entrenar'), 'Carlos aparece sin entrenar');
check(res.find((r) => r.nombre === 'Rubén Martín').alertas.some((a) => a.tipo === 'molestia'), 'Rubén aparece con molestia moderada');
check(res.find((r) => r.nombre === 'Marta Gil').estado === 'invitado', 'Marta está pendiente de activar');
check((await api.plantillas()).length === 2, '2 plantillas');
const bandeja = await api.bandeja();
check(bandeja.comentarios.length === 1 && bandeja.comentarios[0].atleta.nombre === 'Rubén Martín', 'bandeja: el comentario de Rubén sin leer');
check(bandeja.sesiones.length >= 3 && bandeja.checkins.length >= 2, `bandeja: ${bandeja.sesiones.length} sesiones y ${bandeja.checkins.length} check-ins por revisar`);
check((await api.recursos()).filter((r) => r.categoria === 'faq').length === 14, 'las 14 preguntas frecuentes de la app (también cómo escribir al coach y cómo apuntar el cardio)');

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
const prog3 = await api.programa(ana.id);
const pierna = Object.values(prog3.sesiones).flat().find((x) => x.nombre === 'Pierna A');
const detPierna = await api.sesion(pierna.id, ana.id);
check(detPierna.ejercicios.filter((e) => e.superserie === 'A').length === 2, 'Pierna A trae una superserie (leg curl y gemelo)');
const cons = await api.constancia(ana.id);
check(cons.racha >= 1 && cons.mapa.length === 12 && cons.diasEntrenados > 0, `racha de semanas completas (${cons.racha}) y calendario de 12 semanas`);
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
  check((await b.select('comentarios', { eq: { id: nuevo.id } })).length === 0, 'y al borrar el adjunto se va su mensaje');
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
check((await api.atletas()).length === 4, 'con el código 123456, sí');
await b.auth.mfa.quitar(f.id);
await b.auth.entrar('ana@fbe.demo', 'demo');

console.log('\nActivación con código en la demo');
await b.auth.salir();
await b.auth.registrar('marta@correo.test', 'una-contraseña-larga', 'Marta');
check((await api.canjearCodigo('fbe marta 7k3pq')) !== null, 'Marta canjea su código');
check((await api.miAtleta()).nombre === 'Marta Gil', 'queda vinculada a su ficha');

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
