// La capa de datos de la app (web/src/datos/api.js) contra el esquema real de Supabase con RLS.
// Recorre el flujo completo: el coach da de alta, programa y publica; el atleta activa, entrena y hace check-in.
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, lunesDe, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lanza = async (fn) => { try { await fn(); return false; } catch { return true; } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.on('unhandledRejection', (e) => { console.error('ERROR:', e.message); process.exit(1); });

const db = await crearPglite();
const b = crearBackendPglite(db);
const api = crearApi(b);
const hoy = hoyISO();
const lunes = lunesDe(hoy);

// Cuentas
await b.auth.registrar('pelayo@fbe.test', 'contraseña-coach', 'Pelayo');
const coachId = b.auth.sesion().user.id;
await b.sql(`update perfiles set rol = 'coach' where id = $1`, [coachId]);

console.log('Coach: alta, biblioteca y programa');
const ana = await api.crearAtleta({ nombre: 'Ana López', email: 'ana@test', notion_url: 'https://notion.so/ana' });
check(ana.estado === 'invitado', 'crea la atleta como invitada');
const codigo = await api.crearInvitacion(ana.id);
check(/^FBE-/.test(codigo), 'genera su código de invitación');

const [press, remo, sentadilla] = await Promise.all([
  api.crear('ejercicios', { nombre: 'Press banca', grupos_musculares: ['pectoral', 'triceps', 'deltoides'] }),
  api.crear('ejercicios', { nombre: 'Remo con barra', grupos_musculares: ['espalda', 'biceps'] }),
  api.crear('ejercicios', { nombre: 'Sentadilla trasera', grupos_musculares: ['cuadriceps', 'gluteo'] }),
]);
check((await api.biblioteca()).length === 3, 'biblioteca con 3 ejercicios');

const bloque = await api.nuevoBloque(ana.id, { nombre: 'Base de fuerza', foco: 'adaptacion', fecha_inicio: lunes, semanas: 4, sesionesPorSemana: 2 });
let completo = await api.bloqueCompleto(bloque.id);
check(completo.semanas.length === 4, 'el bloque nace con 4 semanas');
const s1 = completo.semanas[0];
const [dia1, dia2] = completo.sesiones[s1.id];
check(dia1.nombre === 'Día 1' && dia2.nombre === 'Día 2', 'la semana 1 trae 2 sesiones vacías');
await api.actualizar('sesiones', dia1.id, { nombre: 'Torso A', intencion: 'rendimiento', dinamica: 'Calienta 5 min' });
const pPress = await api.crear('sesion_ejercicios', { sesion_id: dia1.id, ejercicio_id: press.id, orden: 1, prioridad: 'alta', series: 3, reps_min: 6, reps_max: 8, rir_objetivo: 2, carga_sugerida_kg: 60, descanso_seg: 150 });
await api.crear('sesion_ejercicios', { sesion_id: dia1.id, ejercicio_id: remo.id, orden: 2, prioridad: 'media', series: 3, reps_min: 8, reps_max: 10, rir_objetivo: 2, carga_sugerida_kg: 50, descanso_seg: 120 });
await api.crear('sesion_ejercicios', { sesion_id: dia2.id, ejercicio_id: sentadilla.id, orden: 1, prioridad: 'alta', series: 4, reps_min: 5, reps_max: 5, rpe_objetivo: 8, carga_sugerida_kg: 80, descanso_seg: 180 });
await api.moverPauta(dia1.id, pPress.id, 1);
completo = await api.bloqueCompleto(bloque.id);
check(completo.pautas[dia1.id][1].id === pPress.id, 'reordenar ejercicios dentro de la sesión');
await api.moverPauta(dia1.id, pPress.id, -1);
await api.publicarSemana(s1.id);
await api.activarBloque(bloque.id, ana.id);

const s2 = await api.copiarSemana(s1.id, { bloque_id: bloque.id, numero: 5, fecha_inicio: sumarDias(lunes, 28), progresion: { kg: 2.5, reps: 0, rir: -1 } });
const cs2 = await api.bloqueCompleto(bloque.id);
const pautaCopia = cs2.pautas[cs2.sesiones[s2.id][0].id][0];
check(Number(pautaCopia.carga_sugerida_kg) === 62.5 && Number(pautaCopia.rir_objetivo) === 2, 'copiar semana con progresión (+2,5 kg; lo que sube de kilos no sube además el esfuerzo: RIR igual)');
await api.borrar('semanas', s2.id);

const plantilla = await api.copiarBloque(bloque.id, { nombre: 'Torso-pierna 2 días' });
check(plantilla.es_plantilla && plantilla.atleta_id === null, 'guardar el bloque como plantilla');
check((await api.plantillas()).length === 1, 'la plantilla aparece en la lista');

console.log('\nAtleta: activación');
await b.auth.registrar('ana@test', 'contraseña-ana-1', 'Ana');
check((await api.miAtleta()) === null, 'antes del código no está vinculada');
check((await api.canjearCodigo(codigo.toLowerCase())) === ana.id, 'canjea el código');
check((await api.miAtleta()).id === ana.id, 'queda vinculada a su ficha');
check(!(await api.tieneConsentimientoSalud()), 'sin consentimiento todavía');
check(await lanza(() => api.guardarPeso(ana.id, hoy, 61.5)), 'sin consentimiento no guarda el peso');
await api.darConsentimientos();
check(await api.tieneConsentimientoSalud(), 'da los consentimientos');

console.log('\nAtleta: entrenar');
const prog = await api.programa(ana.id);
check(prog.bloque.id === bloque.id && prog.semanas.length === 1, 've su bloque activo y solo la semana publicada');
check(prog.actual.id === s1.id, 'detecta la semana actual');
const det = await api.sesion(dia1.id, ana.id);
check(det.ejercicios.length === 2 && det.ejercicios[0].ejercicio.nombre === 'Press banca', 'detalle de la sesión con su prescripción');
check(det.ejercicios[0].ultimas === null, 'sin historial previo');
await api.guardarSerie({ sesion_ejercicio_id: det.ejercicios[0].id, numero: 1, kg: 60, reps: 8, rpe: 8 }, ana.id);
await api.guardarSerie({ sesion_ejercicio_id: det.ejercicios[0].id, numero: 2, kg: 62.5, reps: 7, rpe: 9 }, ana.id);
await api.guardarSerie({ sesion_ejercicio_id: det.ejercicios[0].id, numero: 2, kg: 62.5, reps: 8, rpe: 9 }, ana.id);
const det2 = await api.sesion(dia1.id, ana.id);
check(det2.ejercicios[0].hechas.length === 2 && det2.ejercicios[0].hechas[1].reps === 8, 'registrar y corregir series sin duplicar');
await api.marcarSesion(dia1.id, { completada: true, fecha_realizada: hoy, rpe_sesion: 8, duracion_min: 55, nota_atleta: 'Buen día' });
check((await api.programa(ana.id)).sesiones[s1.id].find((s) => s.id === dia1.id).completada, 'terminar la sesión');
check(await lanza(() => api.actualizar('sesiones', dia1.id, { nombre: 'Trampa' })), 'no puede reescribir la prescripción');

// Para comprobar "la última vez": el coach publica la semana 2 (copia de la 1) y la atleta la abre.
const anaSesion = b.auth.sesion();
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
const sem2 = (await api.bloqueCompleto(bloque.id)).semanas.find((s) => s.numero === 2);
await api.borrar('semanas', sem2.id);
const s2b = await api.copiarSemana(s1.id, { bloque_id: bloque.id, numero: 2, fecha_inicio: sumarDias(lunes, 7), progresion: { kg: 2.5 } });
await api.publicarSemana(s2b.id);
await b.auth.entrar('ana@test', 'contraseña-ana-1');
check(b.auth.sesion().user.id === anaSesion.user.id, 'vuelve a entrar con su contraseña');
const prog2 = await api.programa(ana.id);
const det3 = await api.sesion(prog2.sesiones[s2b.id][0].id, ana.id);
const ult = det3.ejercicios[0].ultimas;
check(ult && ult.series.length === 2 && Number(ult.series[1].kg) === 62.5, 'en la semana 2 ve lo que hizo la última vez (62,5 × 8)');
check(Number(det3.ejercicios[0].carga_sugerida_kg) === 62.5, 'y la carga sugerida ya progresada');

console.log('\nAtleta: check-in y progreso');
await api.guardarCheckin(ana.id, lunes, { horas_sueno: '7-8', energia: 4, recuperacion: 4, motivacion: 5, adherencia_comida: 4 }, { hombros: 2, zona_lumbar: 0 }, 61.4);
let ci = await api.checkin(ana.id, lunes);
check(ci.checkin.motivacion === 5 && ci.molestias.length === 1 && Number(ci.pesos[0].kg) === 61.4, 'guarda check-in, molestia y peso');
await api.guardarCheckin(ana.id, lunes, { horas_sueno: '6-7', energia: 3, motivacion: 4 }, { hombros: 0 });
ci = await api.checkin(ana.id, lunes);
check(ci.checkin.horas_sueno === '6-7' && ci.molestias.length === 0, 'reeditar el check-in actualiza y borra la molestia');
const cons = await api.constancia(ana.id);
check(cons.mapa.length === 12 && cons.diasEntrenados === 1 && cons.mapa[11].dias.some((d) => d.iso === hoy && d.nivel === 3), 'constancia: el día de hoy entrenado en el mapa de 12 semanas');
const pr = await api.progreso(ana.id);
check(pr.ejercicios[0].nombre === 'Press banca' && pr.ejercicios[0].mejor === 81.3, `e1RM en progreso (${pr.ejercicios[0]?.mejor} kg)`);
check(pr.volumen.estaSemana.pectoral === 2, 'series de pectoral esta semana: 2');
const exp = await api.exportar(ana.id);
check(exp.series.length === 2 && exp.pesos.length === 1 && exp.consentimientos.length === 2, 'exporta sus datos');

console.log('\nOtra atleta no ve nada de Ana');
await b.auth.registrar('intrusa@test', 'contraseña-intrusa', 'Intrusa');
check((await api.programa(ana.id)).bloque === null, 'no ve su programa');
check((await api.historial(ana.id)).length === 0, 'no ve sus series');
check((await api.atletas()).length === 0, 'no ve la lista de atletas');

console.log('\nCoach: resumen');
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
const res = await api.resumenes();
const r = res.find((x) => x.nombre === 'Ana López');
check(r.semana?.numero === 1 && r.sesiones.completadas === 1 && r.sesiones.total === 2, 'tarjeta: semana 1, 1 de 2 sesiones');
check(r.peso?.kg === 61.4 && r.checkin?.motivacion === 4, 'tarjeta: peso y motivación del check-in');
check(r.ultimaSerie === hoy, 'tarjeta: último registro hoy');
await api.actualizar('atletas', ana.id, { volumen_objetivo: { pectoral: [12, 18] } });
check(igual((await api.progreso(ana.id)).volumenObjetivo, { pectoral: [12, 18] }), 'el coach ajusta el volumen objetivo de Ana y su progreso lo trae');
check(await lanza(() => api.actualizar('atletas', ana.id, { volumen_objetivo: [10, 20] })), 'el volumen objetivo tiene que ser un objeto por músculo');
const nota = await api.crearNota(ana.id, 'Vigilar hombro derecho');
check((await api.ficha(ana.id)).notas.length === 1, 'nota privada guardada');
await api.borrarNota(nota.id);

// ===================================================================== v0.2
console.log('\nCoach: alternativas y variante');
const fondos = await api.crear('ejercicios', { nombre: 'Press con mancuernas', grupos_musculares: ['pectoral', 'triceps'], tipo: ['multiarticular'] });
await api.actualizar('ejercicios', press.id, { alternativas: [fondos.id], tipo: ['basico', 'multiarticular'], errores: 'Rebotar la barra en el pecho' });
const pautaS2 = (await api.bloqueCompleto(bloque.id)).pautas[prog2.sesiones[s2b.id][0].id][0];
await api.actualizar('sesion_ejercicios', pautaS2.id, { variante: 'Pausa de 1 s en el pecho' });

console.log('\nAtleta: cambiar por una alternativa');
await b.auth.entrar('ana@test', 'contraseña-ana-1');
const sesS2 = prog2.sesiones[s2b.id][0];
const detS2 = await api.sesion(sesS2.id, ana.id);
const ePress = detS2.ejercicios[0];
check(ePress.alternativas.length === 1 && ePress.alternativas[0].nombre === 'Press con mancuernas', 've la alternativa equivalente del press');
check(ePress.variante === 'Pausa de 1 s en el pecho' && ePress.ejercicio.errores.startsWith('Rebotar'), 've la variante y los errores comunes');
check(detS2.semana.numero === 2 && detS2.progresionAuto === true, 'trae la semana y si se le sugiere progresión');
await api.guardarSerie({ sesion_ejercicio_id: ePress.id, numero: 1, kg: 24, reps: 10, rpe: 8, sustituto_id: fondos.id }, ana.id);
const histAna = await api.historial(ana.id);
const conMancuernas = histAna.filter((s) => s.sustituto);
check(conMancuernas.length === 1 && conMancuernas[0].ejercicio === 'Press con mancuernas' && conMancuernas[0].pautado === 'Press banca', 'la serie cuenta para la alternativa y recuerda lo pautado');
const hEj = await api.historialEjercicio(ana.id, press.id);
check(hEj.sesiones.length === 1 && hEj.mejor.valor === 81.3, 'historial del press: una sesión, mejor 1RM estimado 81,3 kg');
const ultAlt = await api.ultimasPorEjercicio(ana.id, [fondos.id], null);
check(ultAlt[fondos.id]?.series[0].kg === 24 && ultAlt[fondos.id].pauta === null, 'la «última vez» de la alternativa sale de la serie cambiada');
const previas = await api.marcasPrevias(ana.id, sesS2.id);
check(previas[press.id]?.e1rm?.valor === 81.3 && !previas[fondos.id], 'marcas previas a la sesión de hoy: sin contar lo que lleva hecho');
const vitAna = await api.vitrina(ana.id);
check(vitAna.ejercicios.some((x) => x.nombre === 'Press banca' && x.e1rm.valor === 81.3), 'vitrina de récords con su mejor press');
const csvAna = await api.seriesCsv(ana.id);
check(csvAna.includes(';Press banca;') && csvAna.includes('Press con mancuernas'), 'exporta sus series a CSV');

console.log('\nAtleta y coach: comentarios y revisión');
await api.marcarSesion(sesS2.id, { completada: true, fecha_realizada: hoy, rpe_sesion: 7 });
await api.comentar({ atletaId: ana.id, sesionId: sesS2.id, texto: 'He cambiado el press: el banco estaba ocupado', autor: 'atleta' });
await api.guardarCheckin(ana.id, lunes, { horas_sueno: '7-8', energia: 4 }, {});
await api.guardarMedidas(ana.id, hoy, { cintura_cm: 71.5, cadera_cm: 94 });
check(Number((await api.checkin(ana.id, lunes)).medidas[0].cintura_cm) === 71.5, 'guarda sus medidas');
await api.guardarMarca({ atleta_id: ana.id, ejercicio_id: press.id, kg: 70, reps: 1 });
const marcasAna = await api.marcas(ana.id);
check(marcasAna.length === 1 && marcasAna[0].ejercicio === 'Press banca', 'apunta una marca de test');
const video = await api.subirArchivo(ana.id, new Blob(['vídeo'], { type: 'video/mp4' }), { tipo: 'video_tecnica', sesion_ejercicio_id: ePress.id, nota_atleta: '¿Bajo bien?' });
check(video.ruta.startsWith(`${ana.id}/video-`) && video.ruta.endsWith('.mp4'), 'sube un vídeo de técnica a su carpeta');
check(/^pglite:\/\//.test(await api.urlArchivo(video.ruta)), 'puede verlo');

await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
let bandeja = await api.bandeja();
check(bandeja.sesiones.some((s) => s.id === sesS2.id && s.atleta.id === ana.id && s.series.hechas === 1), 'bandeja: la sesión hecha, con sus series');
check(bandeja.comentarios.length === 1 && bandeja.checkins.length >= 1 && bandeja.archivos.length === 1, 'bandeja: el comentario, el check-in y el vídeo');
check(bandeja.porAtleta[ana.id] === bandeja.total, 'cuenta lo pendiente por atleta');
for (const s of bandeja.sesiones.filter((x) => x.id !== sesS2.id)) await api.marcarRevisado('sesion', s.id);
await api.marcarLeidos(bandeja.comentarios.map((c) => c.id));
await api.comentar({ atletaId: ana.id, sesionId: sesS2.id, texto: 'Bien hecho. La próxima vez, el de mancuernas a 26 kg.', autor: 'coach' });
const ck = bandeja.checkins.find((c) => c.atleta.id === ana.id);
await api.marcarRevisado('checkin', ck.id);
await api.comentar({ atletaId: ana.id, archivoId: video.id, texto: 'Baja un poco más', autor: 'coach', dibujo: { t: 1.2, formas: [{ tipo: 'linea', p: [[0.2, 0.2], [0.8, 0.8]] }] } });
check((await api.comentarios({ atletaId: ana.id, archivoId: video.id })).some((c) => c.dibujo?.formas?.length === 1), 'un comentario del vídeo lleva su dibujo (v0.14)');
check(await lanza(() => api.comentar({ atletaId: ana.id, archivoId: video.id, texto: 'x', autor: 'coach', dibujo: { t: 1, formas: [] } })), 'un dibujo mal formado no se envía');
bandeja = await api.bandeja();
check(bandeja.total === 0, 'al responder o marcar como revisado, la bandeja queda vacía');
check((await api.comentarios({ sesionId: sesS2.id })).length === 2, 'el hilo de la sesión tiene las dos partes');
await api.crear('recursos', { titulo: 'Cómo medir la cintura', categoria: 'tecnica', url: 'https://example.com/cintura' });
await api.crear('objetivos', { atleta_id: ana.id, titulo: 'Press banca 70 kg', fecha_limite: sumarDias(hoy, 60), estado: 'en_curso', progreso_pct: 60 });
const expCoach = await api.exportar(ana.id);
check(expCoach.perfil?.nombre === 'Ana' && expCoach.consentimientos.length === 2 && expCoach.comentarios.length === 3 && expCoach.archivos.length === 1, 'el coach exporta todo lo de Ana, con su perfil y consentimientos');
const copia = await api.copiaCompleta();
check(copia.atletas.length === 1 && copia.series.length === 3 && copia.recursos.length === 1, 'copia completa de la base');

await b.auth.entrar('ana@test', 'contraseña-ana-1');
const pend = await api.noLeidos(ana.id);
check(pend.length === 2, 'la atleta tiene dos respuestas sin leer');
await api.marcarLeidos(pend.map((c) => c.id));
check((await api.noLeidos(ana.id)).length === 0, 'y las marca como leídas al abrirlas');
check((await api.recursos()).length === 1 && (await api.objetivos(ana.id))[0].progreso_pct === 60, 've los recursos y su objetivo');
console.log('\nv0.4: notas, peso, carga y respuestas guardadas');
await api.guardarNotaEjercicio(ana.id, press.id, 'Banco en el 3');
await api.guardarNotaEjercicio(ana.id, press.id, 'Banco en el 4');
check((await api.sesion(sesS2.id, ana.id)).notas[press.id]?.texto === 'Banco en el 4', 'la nota fijada del press se guarda, se cambia y llega con la sesión');
await api.guardarNotaEjercicio(ana.id, remo.id, 'Agarre prono');
await api.guardarNotaEjercicio(ana.id, remo.id, '   ');
check(!(await api.notasEjercicio(ana.id))[remo.id], 'una nota vacía se borra');
await api.guardarPeso(ana.id, sumarDias(hoy, -1), 61.8);
await api.guardarPeso(ana.id, hoy, 61.3);
const misPesos = await api.pesos(ana.id);
check(misPesos.length >= 2 && misPesos[misPesos.length - 1].fecha === hoy && Number(misPesos[misPesos.length - 1].kg) === 61.3, 'se pesa a diario (uno por día) y los recibe en orden');
const diaAna = await api.tuDia(ana.id, { programa: await api.programa(ana.id), checkin: await api.checkin(ana.id, lunes) });
check(diaAna.some((x) => x.id === 'sesion') && diaAna.some((x) => x.id === 'peso') && diaAna.find((x) => x.id === 'checkin')?.estado === 'hecho', 'Tu día: la sesión, el peso y el check-in (ya enviado) de Ana');
const pasosAna = await api.primerosPasos(ana.id);
check(pasosAna.sesion && pasosAna.peso && pasosAna.checkin, 'primeros pasos: sabe que ya entrenó, se pesó e hizo el check-in');
const entrenosAna = await api.entrenamientos(ana.id);
check(entrenosAna.length >= 1 && entrenosAna.every((x) => x.series > 0 && x.tonelaje > 0 && x.musculos.length <= 3 && x.bloque), `su historial trae las ${entrenosAna.length} sesiones hechas con series, tonelaje y bloque`);
console.log('\nv0.6: cómo llega, logros e informe del bloque');
await api.guardarPreparacion(sesS2.id, { sueno: 1, energia: 2, molestias: 3 });
check((await api.sesion(sesS2.id, ana.id)).sesion.preparacion?.sueno === 1, 'guarda cómo llega a la sesión y vuelve con ella');
check(await lanza(() => api.guardarPreparacion(sesS2.id, { sueno: 5, energia: 2, molestias: 3 })), 'la base rechaza respuestas fuera de rango');
const misLogros = await api.logros(ana.id);
check(misLogros.cuentas.sesiones >= 1 && misLogros.cuentas.videos === 1 && misLogros.lista.find((l) => l.id === 'sesiones').nivel >= 1, `logros con sus cuentas reales (${misLogros.cuentas.sesiones} sesiones, 1 vídeo)`);
const misInformes = await api.informes(ana.id);
check(misInformes.length >= 1 && misInformes[0].sesiones.hechas >= 1 && misInformes[0].cumplimiento.series.pautadas > 0, 'informe de su bloque con cumplimiento');
await b.auth.registrar('otra@test', 'contraseña-otra-1', 'Otra');
check(await lanza(() => api.urlArchivo(video.ruta)), 'otra cuenta no puede abrir el vídeo de Ana');
check((await api.informes(ana.id)).length === 0 && (await api.logros(ana.id)).cuentas.sesiones === 0, 'ni ve su informe ni sus logros');
check((await api.guardarPreparacion(sesS2.id, { sueno: 3, energia: 3, molestias: 3 })) === undefined, 'ni puede escribir cómo llega Ana');
check((await api.recursos()).length === 0, 'ni ve los recursos sin estar vinculada');
check((await api.entrenamientos(ana.id)).length === 0 && !(await api.primerosPasos(ana.id)).sesion, 'ni su historial de entrenamientos');

await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
const cargaAna = await api.carga(ana.id);
check(cargaAna.semanas.length === 8 && cargaAna.semanas[7].enCurso && cargaAna.semanas[7].carga === 8 * 55, 'carga semanal de Ana: RPE de sesión × minutos (la sesión sin duración no cuenta)');
const resAna = (await api.resumenes()).find((x) => x.nombre === 'Ana López');
check(resAna.peso.kg === 61.3 && 'carga' in resAna, 'el panel trae su último peso y su carga');
check('cumplimiento' in resAna, 'y su cumplimiento de las últimas semanas');
check((await api.sesion(sesS2.id, ana.id)).sesion.preparacion?.sueno === 1, 'el coach ve cómo llegó a la sesión');
await api.crear('respuestas_guardadas', { titulo: 'Sube', texto: 'Sube 2,5 kg, {nombre}' });
check((await api.respuestasGuardadas()).length === 1, 'el coach guarda una respuesta');

console.log('\nv0.7: avisos y plantilla para varios');
await api.crear('avisos', { texto: 'Del 3 al 9 respondo por la tarde' });
await api.crear('avisos', { texto: 'Ana: el lunes, test de press', atleta_id: ana.id });
await api.crear('avisos', { texto: 'Caducado', desde: sumarDias(hoy, -9), hasta: sumarDias(hoy, -2) });
check((await api.avisosCoach()).length === 3 && (await api.avisosCoach()).filter((a) => !a.hasta || a.hasta >= hoy).length === 2, 'el coach ve todos sus avisos, también el caducado (para poder borrarlo)');
const pepe = await api.crearAtleta({ nombre: 'Pepe Ruiz' });
const asignados = await api.asignarPlantilla(plantilla.id, [ana.id, pepe.id], sumarDias(lunesDe(hoy), 14));
check(asignados.every((x) => x.ok) && asignados[0].bloque.numero >= 2 && asignados[1].bloque.numero === 1, 'asigna la plantilla a dos atletas a la vez, cada uno con su número de bloque');
check((await api.programa(pepe.id, { soloProgramadas: false, bloqueId: asignados[1].bloque.id })).semanas.length > 0, 'y el bloque nuevo trae sus semanas, en borrador');
await api.borrarAtleta(pepe.id);
await b.auth.entrar('ana@test', 'contraseña-ana-1');
const avisosAna = await api.avisos(ana.id);
check(avisosAna.length === 2 && avisosAna.some((a) => a.atleta_id === ana.id), 'Ana ve el aviso general y el suyo (no el caducado)');
await b.auth.entrar('otra@test', 'contraseña-otra-1');
check((await api.avisos(ana.id)).length === 0, 'una cuenta sin ficha no ve ningún aviso');

console.log('\nObjetivos de fuerza y actividad (v0.8)');
{
  const { e1rm } = await import('../web/src/logica/calculos.js');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const deAna = (await api.historial(ana.id)).filter((s) => s.ejercicio_id === press.id);
  const partida = await api.e1rmActual(ana.id, press.id);
  check(partida > 0 && partida === Math.max(...deAna.map((s) => e1rm(s) || 0)), 'el punto de partida es su mejor 1RM estimado reciente en ese ejercicio');
  const o1 = await api.crear('objetivos', { atleta_id: ana.id, titulo: 'Press banca 100 kg a una repetición', ejercicio_id: press.id, kg_objetivo: 100, reps_objetivo: 1, e1rm_inicio: partida, estado: 'en_curso' });
  const o2 = await api.crear('objetivos', { atleta_id: ana.id, titulo: 'Press 60 × 8', ejercicio_id: press.id, kg_objetivo: 60, reps_objetivo: 8, e1rm_inicio: partida, estado: 'en_curso' });
  let lista = await api.objetivos(ana.id);
  const a1 = lista.find((o) => o.id === o1.id), a2 = lista.find((o) => o.id === o2.id);
  check(a1.ejercicio === 'Press banca' && a1.auto.meta === 100 && a1.auto.pct === 0 && a1.auto.actual === partida, 'recién puesto: 0 %, con la meta y el 1RM actual');
  check(!a2.auto.conseguido && a2.auto.yaLoPermite, 'las series de antes de ponerlo no lo dan por conseguido, pero se ve que ya lo permite');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const suyo = (await api.objetivos(ana.id)).find((o) => o.id === o1.id);
  check(suyo?.auto?.meta === 100 && suyo.ejercicio === 'Press banca', 'Ana ve el mismo progreso automático');
  check(await lanza(() => api.actualizar('objetivos', o1.id, { kg_objetivo: 50 })) || (await api.objetivos(ana.id)).find((o) => o.id === o1.id).kg_objetivo == 100, 'y no puede cambiar la marca');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await lanza(() => api.actualizar('objetivos', o1.id, { reps_objetivo: 20 })), 'la base no acepta marcas de más de 12 repeticiones');
  await api.actualizar('objetivos', o2.id, { ejercicio_id: null });
  lista = await api.objetivos(ana.id);
  const m2 = lista.find((o) => o.id === o2.id);
  check(m2.kg_objetivo === null && m2.reps_objetivo === null && !m2.auto, 'al quitarle el ejercicio queda como manual, sin restos de la marca');
  await api.borrar('objetivos', o1.id); await api.borrar('objetivos', o2.id);
  const act = await api.actividad(ana.id);
  check(act.some((e) => e.tipo === 'sesion' && e.titulo.startsWith('Hizo')), 'la actividad recoge sus sesiones hechas');
  check(act.every((e, i) => !i || `${act[i - 1].fecha}|${act[i - 1].cuando}` >= `${e.fecha}|${e.cuando}`), 'de lo más reciente a lo más antiguo');
  check(act.every((e) => e.fecha >= sumarDias(hoy, -45)), 'solo los últimos 45 días');
}

console.log('\nv0.9: errores corregidos en la capa de datos');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const rita = await api.crearAtleta({ nombre: 'Rita Prueba' });
  const lunesR = lunesDe(hoy);
  const pl = await api.nuevaPlantilla({ nombre: 'Plantilla con notas', semanas: 2, sesionesPorSemana: 1 });
  await api.actualizar('semanas', (await api.bloqueCompleto(pl.id)).semanas[0].id, { nota_coach: 'Semana de técnica: graba la primera serie' });
  const blR = await api.copiarBloque(pl.id, { atleta_id: rita.id, fecha_inicio: sumarDias(lunesR, 2) });
  let c = await api.bloqueCompleto(blR.id);
  check(c.bloque.fecha_inicio === lunesR && c.semanas[0].fecha_inicio === lunesR, 'un bloque pedido para un miércoles empieza el lunes de esa semana');
  check(c.semanas[0].nota_coach === 'Semana de técnica: graba la primera serie' && c.semanas[1].nota_coach == null, 'al copiar una plantilla, la nota de cada semana va con ella');
  const ses = c.sesiones[c.semanas[0].id][0];
  const pR = await api.crear('sesion_ejercicios', { sesion_id: ses.id, ejercicio_id: press.id, orden: 1, series: 3, reps_min: 5, reps_max: 8, carga_sugerida_kg: 40 });
  const dup = await api.duplicarSemana(c.semanas[0].id, { kg: 2.5 });
  c = await api.bloqueCompleto(blR.id);
  const pauta2 = (c.pautas[(c.sesiones[c.semanas[1].id] || [])[0]?.id] || [])[0];
  check(dup.numero === 2 && c.semanas.length === 2 && Number(pauta2?.carga_sugerida_kg) === 42.5, 'duplicar con progresión rellena la semana 2, que estaba vacía, en lugar de añadir una tercera');
  await api.cambiarInicioBloque(blR.id, sumarDias(lunesR, -4));
  c = await api.bloqueCompleto(blR.id);
  check(c.bloque.fecha_inicio === sumarDias(lunesR, -7) && c.semanas.map((w) => w.fecha_inicio).join() === [sumarDias(lunesR, -7), lunesR].join(), 'cambiar el inicio del bloque lo lleva al lunes y mueve todas sus semanas');
  // La hora de una serie no cambia al corregirla; nunca en el futuro
  const t0 = new Date(Date.now() - 3 * 864e5).toISOString();
  await api.guardarSerie({ sesion_ejercicio_id: pR.id, numero: 1, kg: 40, reps: 8, registrada_en: t0 }, rita.id);
  await api.guardarSerie({ sesion_ejercicio_id: pR.id, numero: 1, kg: 42.5, reps: 8, registrada_en: t0 }, rita.id);
  await api.guardarSerie({ sesion_ejercicio_id: pR.id, numero: 2, kg: 40, reps: 8, registrada_en: new Date(Date.now() + 5 * 864e5).toISOString() }, rita.id);
  const filas = await b.sql(`select numero, kg, registrada_en from series where sesion_ejercicio_id = $1 order by numero`, [pR.id]);
  check(Number(filas[0].kg) === 42.5 && new Date(filas[0].registrada_en).toISOString() === t0, 'corregir una serie no cambia la hora en que se hizo');
  check(new Date(filas[1].registrada_en).getTime() <= Date.now() + 1000, 'una hora en el futuro se cambia por la de ahora');
  // «La última vez» lleva el día en que hizo la sesión
  await api.marcarSesion(ses.id, { completada: true, fecha_realizada: sumarDias(hoy, -5) });
  const ult = await api.ultimasPorEjercicio(rita.id, [press.id], null);
  check(ult[press.id]?.fecha === sumarDias(hoy, -5) && ult[press.id].series.length === 2, '«la última vez» lleva el día en que hizo la sesión');
  // El panel enseña la semana de un bloque solo planificado (lo mismo que ve el atleta)
  await api.publicarSemana(c.semanas[1].id);
  const filaRita = (await api.resumenes()).find((r) => r.atleta_id === rita.id);
  check(filaRita?.semana?.numero === 2, 'un atleta con su único bloque planificado y la semana publicada sale en el panel con su semana');
  // Retirar no está bloqueado en la capa de datos, pero la nota de la semana se conserva al publicar
  // Los mensajes cuentan por conversación en Revisar
  const antes = (await api.bandeja()).total;
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.comentar({ atletaId: ana.id, texto: 'Una duda sobre el calentamiento', autor: 'atleta' });
  await api.comentar({ atletaId: ana.id, texto: 'Y otra cosa más', autor: 'atleta' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const band = await api.bandeja();
  check(band.total - antes === 1, 'dos mensajes seguidos en la misma conversación cuentan como una cosa por revisar');
  // Medidas: apuntar una no borra las demás de ese día
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const diaM = sumarDias(hoy, -40);
  await api.guardarMedidas(ana.id, diaM, { cintura_cm: 70, pecho_cm: 90 });
  await api.guardarMedidas(ana.id, diaM, { brazo_cm: 30 });
  const med = (await api.medidas(ana.id)).find((m) => m.fecha === diaM);
  check(Number(med.cintura_cm) === 70 && Number(med.pecho_cm) === 90 && Number(med.brazo_cm) === 30, 'apuntar una medida no borra las que ya había de ese día');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  // Su exportación lleva también sus recursos
  await api.crear('recursos', { titulo: 'Guía solo para Ana', categoria: 'general', atleta_id: ana.id });
  check((await api.exportar(ana.id)).recursos?.some((r) => r.titulo === 'Guía solo para Ana'), 'la exportación de sus datos lleva los recursos que son solo suyos');
  // CSV sin fórmulas
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pAna = (await api.bloqueCompleto(bloque.id)).pautas[dia1.id][0];
  await api.guardarSerie({ sesion_ejercicio_id: pAna.id, numero: 9, kg: 20, reps: 5, nota: '=HYPERLINK("http://x.test","clic")' }, ana.id);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const csv = await api.seriesCsv(ana.id);
  check(csv.includes(`"'=HYPERLINK(""http://x.test"",""clic"")"`), 'una nota que empieza por = sale en el CSV como texto, no como fórmula');
  // El historial completo se descarga una vez aunque lo pidan a la vez varias partes de la pantalla,
  // y cualquier escritura (o cambio de sesión) lo vuelve a pedir
  let consultas = 0;
  const contador = new Proxy(b, { get: (o, k) => k === 'select' ? (t, q) => { if (t === 'series') consultas++; return o.select(t, q); } : o[k] });
  const apiC = crearApi(contador);
  const [h1, h2, h3] = await Promise.all([apiC.historial(ana.id), apiC.historial(ana.id), apiC.historial(ana.id)]);
  check(consultas === 1 && h1.length === h2.length && h2.length === h3.length && h1[0] !== h2[0], 'tres peticiones del historial a la vez: una sola descarga (y cada una con su copia)');
  await apiC.borrarSerie(pAna.id, 9);
  const h4 = await apiC.historial(ana.id);
  check(consultas >= 2 && h4.length === h1.length - 1, 'tras borrar una serie, el historial vuelve a pedirse y ya no la trae');
  await api.borrarAtleta(rita.id);
  await api.borrar('bloques', pl.id);
}

console.log('\nv0.10: hábitos, plan de la semana, top + back-off y pose de las fotos');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const pasos = await api.guardarHabito(ana.id, { nombre: 'Pasos', tipo: 'numero', objetivo: 8000, unidad: 'pasos', icono: 'pasos', dias_semana: 6 });
  const mov = await api.guardarHabito(ana.id, { nombre: 'Movilidad', tipo: 'si_no', objetivo: 50, unidad: 'min', icono: 'movilidad', dias_semana: 3 });
  check(pasos.orden === 0 && mov.orden === 1 && mov.objetivo === null && mov.unidad === null, 'el coach pone dos hábitos (en uno de sí/no no se guarda objetivo ni unidad)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.apuntarHabito(pasos.id, hoy, 6000);
  await api.apuntarHabito(pasos.id, hoy, 9100);
  await api.apuntarHabito(mov.id, hoy, 1);
  await api.apuntarHabito(pasos.id, sumarDias(hoy, -1), 8200);
  const rh = await api.resumenHabitos(ana.id, hoy);
  const rp = rh.find((r) => r.habito.id === pasos.id);
  check(rh.length === 2 && rp.hoy === 9100 && rp.cumpleHoy && rp.rachaDias === 2, 'Ana apunta sus pasos (corregir el mismo día lo reemplaza) y lleva 2 días seguidos');
  check(rh.find((r) => r.habito.id === mov.id).cumpleHoy, 'y marca la movilidad como hecha');
  await api.apuntarHabito(pasos.id, sumarDias(hoy, -1), null);
  check((await api.registrosHabitos(ana.id, sumarDias(hoy, -7))).length === 2, 'borrar lo de un día lo quita');
  check(await lanza(() => api.apuntarHabito(mov.id, hoy, 3)) && await lanza(() => api.apuntarHabito(pasos.id, sumarDias(hoy, 5), 1000)), 'no se apuntan valores raros ni días que no han llegado');
  // El plan de la semana: elegir el día de una sesión no la deja «por revisar»
  const prog = await api.programa(ana.id);
  const ses = (prog.sesiones[prog.actual.id] || []).find((x) => !x.completada) || (prog.sesiones[prog.actual.id] || [])[0];
  const antes = (await b.select('sesiones', { eq: { id: ses.id } }))[0].revisada_en;
  const dia = sumarDias(prog.actual.fecha_inicio, 3);
  await api.marcarSesion(ses.id, { dia_previsto: dia });
  const tras = (await b.select('sesiones', { eq: { id: ses.id } }))[0];
  check(tras.dia_previsto === dia && tras.revisada_en === antes, 'Ana planifica el jueves para una sesión (y su revisión no cambia)');
  check(await lanza(() => api.marcarSesion(ses.id, { dia_previsto: sumarDias(prog.actual.fecha_inicio, 9) })), 'un día fuera de esa semana no se acepta');
  await api.marcarSesion(ses.id, { dia_previsto: null });
  // Foto con pose
  const foto = await api.subirArchivo(ana.id, new Blob(['jpg'], { type: 'image/jpeg' }), { tipo: 'foto_progreso', pose: 'perfil' });
  check(foto.pose === 'perfil', 'una foto de progreso se guarda con su pose');
  await api.borrarArchivo(foto);
  // El coach: top + back-off se copia al duplicar, el panel ve los hábitos y la exportación los lleva
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const pl = await api.nuevaPlantilla({ nombre: 'Con back-off', semanas: 2, sesionesPorSemana: 1 });
  const c1 = await api.bloqueCompleto(pl.id);
  const sesPl = c1.sesiones[c1.semanas[0].id][0];
  const pauta = await api.crear('sesion_ejercicios', { sesion_id: sesPl.id, ejercicio_id: press.id, orden: 1, series: 4, reps_min: 4, reps_max: 6, rpe_objetivo: 8, carga_sugerida_kg: 80, backoff_pct: 10 });
  await api.duplicarSemana(c1.semanas[0].id, { kg: 2.5 });
  const c2 = await api.bloqueCompleto(pl.id);
  const copia = (c2.pautas[(c2.sesiones[c2.semanas[1].id] || [])[0]?.id] || [])[0];
  check(Number(copia?.backoff_pct) === 10 && Number(copia.carga_sugerida_kg) === 82.5, 'duplicar la semana copia la serie top y el back-off (y sube la top)');
  check(await lanza(() => api.actualizar('sesion_ejercicios', pauta.id, { series: 1 })), 'con top + back-off no se puede dejar en una serie');
  await api.borrar('bloques', pl.id);
  const fila = (await api.resumenes()).find((r) => r.atleta_id === ana.id);
  check(fila.habitos === null, 'en el panel, hábitos recién puestos aún no cuentan (hace falta una semana)');
  const exp10 = await api.exportar(ana.id);
  check(exp10.habitos.length === 2 && exp10.registros_habito.length === 2, 'la exportación de Ana lleva sus hábitos y lo que ha apuntado');
  const q = await api.quitarHabito(mov.id);
  const sinNada = await api.guardarHabito(ana.id, { nombre: 'Agua', tipo: 'numero', objetivo: 2, unidad: 'l', icono: 'agua' });
  const q2 = await api.quitarHabito(sinNada.id);
  check(q.archivado && !q2.archivado && (await api.habitos(ana.id)).length === 1 && (await api.habitos(ana.id, { todos: true })).length === 2, 'quitar un hábito con días apuntados lo archiva; sin nada apuntado, lo borra');
  // Revisión independiente de la v0.10
  check(await lanza(() => api.guardarHabito(ana.id, { ...pasos, tipo: 'si_no' }, pasos.id)), 'un hábito con días apuntados no pasa de número a sí/no');
  const agua = await api.guardarHabito(ana.id, { nombre: 'Agua', tipo: 'numero', objetivo: 2.25, unidad: 'l', icono: 'agua' });
  check(Number(agua.objetivo) === 2.25, 'el objetivo admite dos decimales (2,25 l)');
  await b.sql(`update habitos set creado_en = now() - interval '200 days' where id = $1`, [agua.id]);
  await b.sql(`insert into registros_habito (habito_id, atleta_id, fecha, valor) select $1, $2, d::date, 2.5 from generate_series($3::date, $4::date, interval '1 day') d`, [agua.id, ana.id, sumarDias(hoy, -150), sumarDias(hoy, -1)]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.apuntarHabito(agua.id, hoy, 0.75);
  check(Number((await b.select('registros_habito', { eq: { habito_id: agua.id, fecha: hoy } }))[0].valor) === 0.75, 'un 0,75 l se guarda como 0,75 (no como 0,8)');
  const ra = (await api.resumenHabitos(ana.id, hoy)).find((r) => r.habito.id === agua.id);
  check(ra.rachaDias === 150, `una racha de 150 días se cuenta entera (antes se quedaba en 71): ${ra.rachaDias}`);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
}

console.log('\nv0.11: nutrición');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const lunesN = lunesDe(hoy);
  const v1 = await api.guardarPlanNutricion(ana.id, { desde: sumarDias(lunesN, -28), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 2200, proteina_g: 130, carbos_g: 255, grasa_g: 65, carbos_descanso_g: 200, pautas: '  Proteína en cada comida  ' });
  check(v1.pautas === 'Proteína en cada comida' && v1.kcal_descanso === null && v1.carbos_descanso_g === null, 'el coach crea el plan (un día de descanso a medias, sin sus kcal, no se guarda)');
  const v2 = await api.guardarPlanNutricion(ana.id, { desde: sumarDias(lunesN, -7), modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 2100, proteina_g: 130, carbos_g: 230, grasa_g: 65, kcal_descanso: 1900, carbos_descanso_g: 180, grasa_descanso_g: 65, motivo: 'Ajuste' });
  await api.guardarPlanNutricion(ana.id, { ...v2, kcal: 2120, carbos_g: 235 });
  check((await api.planesNutricion(ana.id)).length === 2, 'cada cambio es una versión desde una fecha; el mismo día, se corrige');
  const futuro = await api.guardarPlanNutricion(ana.id, { desde: sumarDias(lunesN, 7), modo: 'sin_contar', fase: 'mantener', ritmo_pct: 0, kcal: 2000, pautas: 'Come tranquila' });
  check(futuro.kcal === null, 'en «sin contar» no se guardan cifras aunque lleguen');
  // 28 días de registro y de peso: come 2000 y baja 300/7700 kg al día → gasta 2300
  await b.sql(`insert into registros_nutricion (atleta_id, fecha, kcal, proteina_g) select $1, d::date, 2000, 125 from generate_series($2::date, $3::date, interval '1 day') d`, [ana.id, sumarDias(hoy, -30), sumarDias(hoy, -1)]);
  await b.sql(`insert into pesos (atleta_id, fecha, kg) select $1, d::date, round((65 - (d::date - $2::date) * 300.0 / 7700)::numeric, 2) from generate_series($2::date, $3::date, interval '1 day') d
    on conflict (atleta_id, fecha) do update set kg = excluded.kg`, [ana.id, sumarDias(hoy, -30), hoy]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.apuntarNutricion(ana.id, hoy, { kcal: 900, proteina_g: 60, carbos_g: '', nota: '  desayuno y comida ' });
  const rn = await api.resumenNutricion(ana.id, hoy);
  check(rn.plan.id === v2.id && rn.plan.kcal === 2120 && rn.siguiente.id === futuro.id && rn.hoy.nota === 'desayuno y comida' && rn.hoy.carbos_g === null, 'Ana ve su plan vigente, el que viene y lo que lleva hoy');
  check(Math.abs(rn.gasto.kcal - 2300) <= 20 && rn.gasto.fiabilidad === 'alta', `su gasto adaptativo sale de lo comido y del peso (${rn.gasto.kcal} kcal)`);
  check(rn.ajuste === null && rn.semana.dias.find((d) => d.iso === hoy).estado === 'en_curso', 'hoy va «en curso»; con una versión «sin contar» ya preparada, no se propone ajuste (se calcula sobre la que viene)');
  await api.apuntarNutricion(ana.id, hoy, null);
  check(!(await api.registrosNutricion(ana.id, hoy)).length, 'borrar lo de un día lo quita');
  check(await lanza(() => api.apuntarNutricion(ana.id, sumarDias(hoy, 4), { kcal: 2000 })) && await lanza(() => api.apuntarNutricion(ana.id, hoy, { kcal: 50000 })), 'ni días que no han llegado ni cifras imposibles');
  check(await lanza(() => api.guardarPlanNutricion(ana.id, { desde: hoy, modo: 'macros', kcal: 2000, proteina_g: 120, carbos_g: 200, grasa_g: 60 })), 'Ana no puede ponerse un plan');
  const expN = await api.exportar(ana.id);
  check(expN.planes_nutricion.length === 3 && expN.registros_nutricion.length >= 30, 'la exportación de Ana lleva sus planes y lo que ha apuntado');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.borrarPlanNutricion(futuro.id);
  check((await api.planesNutricion(ana.id)).length === 2, 'el coach puede quitar una versión que aún no ha empezado');
  const rnC = await api.resumenNutricion(ana.id, hoy);
  check(rnC.ajuste && Math.abs(rnC.ajuste.objetivo - 1950) <= 30, `sin ella, el ajuste es para su ritmo (${rnC.ajuste?.texto})`);
  const filaN = (await api.resumenes()).find((r) => r.atleta_id === ana.id);
  check(!filaN.alertas.some((x) => x.tipo === 'nutricion_registro'), 'en el panel, quien apunta a diario no tiene aviso de nutrición');
}

console.log('\nNotificaciones (v0.12)');
{
  const llamadas = [];
  b.funcion = async (nombre) => { llamadas.push(nombre); return {}; };   // como la de Supabase, que la app llama al momento
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pd = await api.preferenciasNotificaciones();
  check(pd.hora_tarde === '21:00' && pd.desactivados.join() === 'sesion_hecha' && pd.silencio_desde === '22:30', 'sin guardar nada, las preferencias de entrada (como la base)');
  const g = await api.guardarPreferenciasNotificaciones({ ...pd, desactivados: ['habitos'], hora_tarde: '20:30', silencio_desde: null, silencio_hasta: null });
  check(g.hora_tarde === '20:30' && g.desactivados.join() === 'habitos' && g.silencio_desde === null, 'Ana guarda las suyas: sin hábitos, a las 20:30 y sin «no molestar»');
  check((await api.guardarPreferenciasNotificaciones({ ...g, hora_tarde: '20:45' })).hora_tarde === '20:45', 'y cambiarlas otra vez las actualiza (una fila por cuenta)');
  check(await lanza(() => api.guardarPreferenciasNotificaciones({ ...g, hora_manana: '15:00' })), 'una hora de la mañana por la tarde no se acepta');
  check((await api.probarNotificacion()) === 'sin_canal', 'sin ningún móvil activado, la de prueba dice que no hay dónde enviarla');
  const clave = (n) => ['B' + String.fromCharCode(65 + n).repeat(86), String.fromCharCode(65 + n).repeat(22)];
  await api.registrarSuscripcion({ endpoint: 'https://fcm.googleapis.com/fcm/send/ana-movil', p256dh: clave(0)[0], auth: clave(0)[1], dispositivo: 'Android · Chrome' });
  await api.registrarSuscripcion({ endpoint: 'https://web.push.apple.com/ana-ipad', p256dh: clave(1)[0], auth: clave(1)[1], dispositivo: 'iPad · Safari' });
  await api.registrarSuscripcion({ endpoint: 'https://fcm.googleapis.com/fcm/send/ana-movil', p256dh: clave(2)[0], auth: clave(2)[1], dispositivo: 'Android · Chrome' });
  const subs = await api.suscripcionesPush();
  check(subs.length === 2 && subs.some((x) => x.dispositivo === 'iPad · Safari'), 'activa sus notificaciones en el móvil y en el iPad (volver a activarlas en el mismo no lo duplica)');
  check(await lanza(() => api.registrarSuscripcion({ endpoint: 'https://otra-web.example.com/x', p256dh: clave(3)[0], auth: clave(3)[1] })), 'solo con servicios de push conocidos');
  llamadas.length = 0;
  check((await api.probarNotificacion()) === 'ok', 'ahora, la de prueba sí');
  await new Promise((r) => setTimeout(r, 30));
  check(llamadas.includes('enviar-notificaciones'), 'y la app pide al servidor que la envíe ya (sin esperar al siguiente minuto)');
  check(await api.actualizarSuscripcion({ anterior: 'https://web.push.apple.com/ana-ipad', endpoint: 'https://web.push.apple.com/ana-ipad-2', p256dh: clave(4)[0], auth: clave(4)[1] }) === true
    && (await api.suscripcionesPush()).some((x) => x.endpoint === 'https://web.push.apple.com/ana-ipad-2'), 'si el navegador renueva la suscripción, la app la pone al día');
  await api.quitarDispositivo(subs.find((x) => x.dispositivo === 'iPad · Safari').id);
  check(await api.actualizarSuscripcion({ anterior: 'https://web.push.apple.com/ana-ipad-2', endpoint: 'https://web.push.apple.com/ana-ipad-3', p256dh: clave(5)[0], auth: clave(5)[1] }) === false,
    'y si se quitó desde otro móvil, no la recupera');
  await api.borrarSuscripcion('https://otra-web.example.com/x');
  check((await api.suscripcionesPush()).length === 1, 'quita el iPad de la lista');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.suscripcionesPush()).length === 0 && (await api.ultimasNotificaciones()).length === 0, 'el coach no ve los móviles ni las notificaciones de Ana');
  llamadas.length = 0;
  await api.comentar({ atletaId: ana.id, sesionId: dia1.id, texto: 'Buen trabajo hoy' });
  await new Promise((r) => setTimeout(r, 1700));
  check(llamadas.length === 1, 'al responderle, la app del coach pide enviar ya lo pendiente (una vez por ráfaga)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const ult = await api.ultimasNotificaciones();
  check(ult[0]?.titulo === 'Pelayo te ha respondido' && ult[0].cuerpo === 'En Torso A' && ult.some((x) => x.titulo === 'Notificaciones activadas'), 'Ana ve las últimas: la respuesta del coach y la de prueba');
  const exp = await api.exportar(ana.id);
  check(exp.notificaciones.length === ult.length && exp.preferencias_notificaciones[0].hora_tarde.startsWith('20:45')
    && exp.suscripciones_push.length === 1 && !('p256dh' in exp.suscripciones_push[0]) && !('endpoint' in exp.suscripciones_push[0]),
    'su descarga de datos lleva sus notificaciones y preferencias, y sus móviles sin las claves');
  delete b.funcion;
  await api.borrarSuscripcion('https://fcm.googleapis.com/fcm/send/ana-movil');
  check((await api.suscripcionesPush()).length === 0, 'al cerrar sesión (o desactivarlas) en el móvil, se borra de la base');
}

console.log('\nCuestionario inicial y check-in a medida (v0.13)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const pedido = await api.pedirCuestionario(ana.id);
  check(!!pedido.pedido_en && pedido.completado_en === null, 'el coach le pide el cuestionario a Ana');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(!!(await api.cuestionario(ana.id))?.pedido_en && !(await api.primerosPasos(ana.id)).cuestionario, 'Ana ve que se lo pide (y aún no lo tiene hecho)');
  await api.guardarCuestionario(ana.id, { objetivo: 'fuerza', objetivo_detalle: '  Una dominada  ', experiencia: '1_3', dias_semana: '3', minutos_sesion: 60 });
  await api.guardarCuestionario(ana.id, { lugar: 'gimnasio', material: ['barra', 'rack', 'barra'] });
  await api.guardarCuestionario(ana.id, { activo: true, enfermedad: true, enfermedad_detalle: 'Diabetes tipo 1', sintomas: [], otras: ['medicacion'], medicacion_detalle: 'Insulina' });
  const hecho = await api.guardarCuestionario(ana.id, { lesiones: [{ zona: 'rodilla', limita: 1, nota: 'La izquierda' }], alergias: '' }, { completar: true });
  check(hecho.objetivo === 'fuerza' && hecho.objetivo_detalle === 'Una dominada' && hecho.material.join() === 'barra,rack' && hecho.lugar === 'gimnasio' && hecho.alergias === null,
    'lo rellena paso a paso: cada paso guarda lo suyo sin borrar lo anterior');
  check(hecho.resultado === 'valorar_antes_vigoroso' && !!hecho.completado_en && (await api.primerosPasos(ana.id)).cuestionario,
    'al terminar, la base pone la recomendación (con diabetes y ya entrenando: valoración antes de la intensidad vigorosa)');
  const multi = await api.guardarCuestionario(ana.id, { objetivos: ['perder_grasa', 'fuerza'] });
  check(multi.objetivos.join() === 'perder_grasa,fuerza' && multi.objetivo === 'perder_grasa' && multi.objetivo_detalle === 'Una dominada',
    'v0.20: marca varios objetivos (el primero, el principal) sin tocar lo demás');
  await api.guardarCuestionario(ana.id, { objetivos: ['fuerza'] });
  await b.update('cuestionarios', { revisado_en: new Date().toISOString() }, { eq: { id: hecho.id } });
  check((await api.cuestionario(ana.id)).revisado_en === null, 'Ana no puede darlo por revisado');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const alertaCu = () => api.resumenes().then((rs) => rs.find((r) => r.atleta_id === ana.id).alertas.find((x) => x.tipo === 'cuestionario'));
  const a1 = await alertaCu();
  check(a1?.nivel === 'info' && /vigorosa/.test(a1.texto) && !/diabetes|insulina/i.test(a1.texto), 'el panel del coach avisa (sin decir qué enfermedad ni qué medicación)');
  await api.revisarCuestionario(hecho.id);
  check(!(await alertaCu()), 'al revisarlo, el aviso se va');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const cambiado = await api.guardarCuestionario(ana.id, { sintomas: ['palpitaciones'] }, { completar: true });
  check(cambiado.resultado === 'parar_y_valorar' && cambiado.revisado_en === null, 'si después cuenta un síntoma, la recomendación cambia y vuelve a estar por revisar');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await alertaCu())?.nivel === 'alerta', 'y el panel lo avisa lo primero (con síntomas y entrenando, que pare)');

  // Check-in a medida
  check((await api.guardarApartadosCheckin(ana.id, ['peso', 'descanso', 'molestias', 'alimentacion', 'medidas', 'reloj'])).checkin_apartados === null
    && (await api.guardarApartadosCheckin(ana.id, ['molestias', 'descanso', 'horoscopo'])).checkin_apartados.join() === 'descanso,molestias',
    'el coach elige qué apartados le pregunta (todos = sin lista; en el orden del check-in y solo los que existen)');
  const pT = await api.guardarPregunta({ atleta_id: null, texto: '  Estrés en   el trabajo ', tipo: 'escala', unidad: 'kg', etiqueta_min: 'Nada', etiqueta_max: 'Muchísimo' });
  const pN = await api.guardarPregunta({ atleta_id: ana.id, texto: 'Horas de pie', tipo: 'numero', unidad: 'h', etiqueta_min: 'x' });
  const pX = await api.guardarPregunta({ atleta_id: ana.id, texto: '¿Algo más?', tipo: 'texto' });
  check(pT.texto === 'Estrés en el trabajo' && pT.unidad === null && pT.etiqueta_max === 'Muchísimo' && pN.etiqueta_min === null && pN.unidad === 'h' && pN.orden > pT.orden,
    'crea preguntas (para todos o solo para Ana) y guarda solo lo que va con cada tipo');
  check(await lanza(() => api.guardarPregunta({ atleta_id: ana.id, texto: '   ' })), 'una pregunta sin texto no se guarda');
  const extra = [];
  for (let i = 0; i < 13; i++) extra.push(await api.guardarPregunta({ atleta_id: ana.id, texto: `Pregunta ${i}`, tipo: 'si_no' }));
  check(await lanza(() => api.guardarPregunta({ atleta_id: ana.id, texto: 'Una de más', tipo: 'si_no' })), 'como mucho 15 preguntas activas solo para un atleta (y 10 para todos)');
  for (const x of extra) await api.quitarPregunta(x.id);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pregs = await api.preguntasCheckin(ana.id);
  check(pregs.map((p) => p.id).join() === [pT.id, pN.id, pX.id].join() && (await api.miAtleta()).checkin_apartados.join() === 'descanso,molestias', 'Ana ve sus preguntas y qué apartados le tocan');
  const lunesR = sumarDias(lunes, -14);
  await api.guardarCheckin(ana.id, lunesR, { energia: 4, respuestas: { [pT.id]: 4, [pN.id]: 7.5 } });
  const ckLeido = (await api.checkin(ana.id, lunesR)).checkin.respuestas;
  const ordenado = (o) => JSON.stringify(Object.entries(o || {}).sort());  // jsonb no guarda el orden de las claves
  check(ordenado(ckLeido) === ordenado({ [pT.id]: 4, [pN.id]: 7.5 }), 'y las responde en su check-in');
  check(await lanza(() => api.guardarCheckin(ana.id, lunesR, { energia: 4, respuestas: { [pT.id]: 9 } })), 'una respuesta fuera de su escala no se guarda');
  await api.guardarCheckin(ana.id, lunesR, { energia: 5 });
  check((await api.checkin(ana.id, lunesR)).checkin.respuestas?.[pN.id] === 7.5, 'corregir el check-in sin tocar las respuestas las deja como estaban');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const q1 = await api.quitarPregunta(pN.id);
  const q2 = await api.quitarPregunta(pX.id);
  check(q1.archivado && q2.archivado === false && (await api.preguntasCheckin(ana.id)).length === 1 && (await api.preguntasCheckin(ana.id, { archivadas: true })).length === 2,
    'quitar una pregunta con respuestas la archiva (no se pierden); sin respuestas, se borra');
  await api.recuperarPregunta(pN.id);
  check((await api.preguntasCheckin(ana.id)).length === 2, 'y una archivada se puede recuperar');
  check(await lanza(() => api.guardarPregunta({ texto: 'Horas de pie', tipo: 'texto' }, pN.id)), 'con respuestas, no cambia de tipo');
  await b.sql(`update consentimientos set revocado_en = now() where tipo = 'datos_salud' and perfil_id = (select perfil_id from atletas where id = $1)`, [ana.id]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const sinSalud = await api.borrarSaludCuestionario(ana.id);
  check(sinSalud.resultado === null && sinSalud.sintomas === null && sinSalud.medicacion_detalle === null && sinSalud.objetivo === 'fuerza',
    'tras retirar el consentimiento, Ana puede borrar lo de salud de su cuestionario (y el resto se queda)');
  await b.sql(`update consentimientos set revocado_en = null where tipo = 'datos_salud' and perfil_id = (select perfil_id from atletas where id = $1)`, [ana.id]);
  await api.guardarCuestionario(ana.id, { activo: true, enfermedad: true, enfermedad_detalle: 'Diabetes tipo 1', sintomas: ['palpitaciones'], otras: ['medicacion'], medicacion_detalle: 'Insulina' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const expQ = await api.exportar(ana.id);
  check(expQ.cuestionarios.length === 1 && expQ.cuestionarios[0].medicacion_detalle === 'Insulina' && expQ.preguntas_checkin.length === 2, 'su descarga de datos lleva el cuestionario y las preguntas que le hacen');
  check(await lanza(() => api.guardarPregunta({ atleta_id: ana.id, texto: 'Me la invento' })), 'Ana no puede crearse preguntas');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const fAna = await api.funcionesAtleta(ana.id);
  check(fAna.preguntas === 2 && fAna.apartados?.join() === 'descanso,molestias' && fAna.cuestionario === 'hecho' && fAna.nutricion === 'macros', 'el coach ve de un vistazo lo que tiene puesto Ana (preguntas, apartados, cuestionario, nutrición)');
  const copiaQ = await api.copiaCompleta();
  check(copiaQ.cuestionarios.length === 1 && copiaQ.preguntas_checkin.length === 2, 'la copia completa del coach también los lleva');
}

console.log('\nMensajes y cardio (v0.17)');
{
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const msg = await api.comentar({ atletaId: ana.id, texto: 'La semana que viene estoy de viaje: ¿cambio la tercera sesión?', autor: 'atleta' });
  check(msg.autor === 'atleta' && !msg.sesion_id && !msg.checkin_id && !msg.archivo_id, 'Ana escribe a su coach fuera de cualquier sesión (la conversación general)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const band = await api.bandeja();
  check(band.comentarios.some((c) => c.id === msg.id && c.atleta.nombre === 'Ana López'), 'al coach le sale en Revisar como un mensaje');
  const resp = await api.comentar({ atletaId: ana.id, texto: 'Sí: haz las dos que puedas y la tercera con mancuernas.', autor: 'coach' });
  check(resp.autor === 'coach' && resp.atleta_id === ana.id, 'y le contesta en la misma conversación');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const general = await api.comentarios({ atletaId: ana.id });
  check(general.at(-2)?.id === msg.id && general.at(-1)?.id === resp.id && general.every((c) => !c.sesion_id && !c.checkin_id && !c.archivo_id) && (await api.noLeidos(ana.id)).some((c) => c.id === resp.id), 'Ana ve su mensaje y la respuesta en la conversación general (solo mensajes sueltos), y la respuesta cuenta como no leída');

  // Cardio: el coach pauta un rodaje en la semana 1 (ya publicada); Ana lo registra al terminar
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [rodaje] = await b.insert('sesiones', [{ semana_id: s1.id, orden: 9, nombre: 'Rodaje', tipo: 'cardio' }]);
  await api.actualizar('sesiones', rodaje.id, { cardio: { modalidad: 'carrera', minutos: 30, esfuerzo: 5, nota: 'Llano' } });
  check(await lanza(() => api.actualizar('sesiones', rodaje.id, { cardio: { modalidad: 'carrera' } })), 'una pauta sin minutos ni km no entra');
  const dup = await api.duplicarSemana(s1.id);
  const copiado = (await b.select('sesiones', { eq: { semana_id: dup.id, nombre: 'Rodaje' } }))[0];
  check(copiado?.cardio?.minutos === 30 && copiado.cardio.modalidad === 'carrera', 'duplicar la semana copia la pauta de cardio');
  await b.delete('semanas', { eq: { id: dup.id } });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const vista = await api.sesion(rodaje.id, ana.id);
  check(vista.sesion.cardio?.nota === 'Llano', 'Ana ve la pauta en su sesión');
  check(await lanza(() => api.actualizar('sesiones', rodaje.id, { cardio: { modalidad: 'bici', minutos: 10 } })), 'pero no puede cambiarla');
  check(await lanza(() => api.marcarSesion(rodaje.id, { cardio_hecho: { modalidad: 'carrera' } })), 'ni registrar cardio sin minutos');
  const hecha = await api.marcarSesion(rodaje.id, { completada: true, fecha_realizada: hoy, rpe_sesion: 5, duracion_min: 32, cardio_hecho: { modalidad: 'carrera', minutos: 32, km: 5.2 } });
  check(hecha.completada && hecha.cardio_hecho.km === 5.2, 'registra 32 minutos y 5,2 km al terminar');
  const porSemana = await api.cardioSemanas(ana.id, 4);
  const estaSemana = porSemana[porSemana.length - 1];
  check(porSemana.length === 4 && estaSemana.minutos >= 32 && estaSemana.km >= 5.2 && estaSemana.sesiones >= 1, 'la gráfica de cardio suma lo de esta semana');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const act = await api.actividad(ana.id);
  check(act.some((x) => /Hizo Rodaje/.test(x.titulo) && /carrera: 32 min, 5,2 km/.test(x.detalle)), 'en la actividad del atleta sale «carrera: 32 min, 5,2 km»');
  await b.delete('sesiones', { eq: { id: rodaje.id } });
}

console.log('\nChat y diario (v0.18)');
{
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const antes = (await api.conversacion(ana.id)).length;
  const foto = await api.enviarMensaje(ana.id, { texto: 'Mira cómo tengo la rodilla', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  check(foto.archivo_id && foto.texto === 'Mira cómo tengo la rodilla', 'Ana manda una foto con texto desde el chat');
  const [adjunto] = await b.select('archivos', { eq: { id: foto.archivo_id } });
  check(adjunto.tipo === 'adjunto' && (await b.storage.url(adjunto.ruta)), 'la foto se guarda como adjunto del chat, subida a Storage');
  const vid = await api.enviarMensaje(ana.id, { texto: '¿Voy bien de profundidad?', archivo: new Blob(['mp4'], { type: 'video/mp4' }), autor: 'atleta', enDiario: true, poster: new Blob(['jpg'], { type: 'image/jpeg' }), duracion_seg: 31 });
  const [tecnica] = await b.select('archivos', { eq: { id: vid.archivo_id } });
  check(tecnica.tipo === 'video_tecnica' && tecnica.poster_ruta === `${tecnica.ruta}.jpg` && tecnica.duracion_seg === 31 && tecnica.nota_atleta === '¿Voy bien de profundidad?' && (await b.storage.url(tecnica.poster_ruta)),
    'un vídeo «para el diario» se guarda como vídeo de técnica, con su miniatura y su duración');
  check(foto.adjunto === true && vid.adjunto === false && api.esMensaje(foto) && !api.esMensaje(vid) && api.esMensaje({ sesion_id: null, checkin_id: null, archivo_id: null }),
    'el mensaje de la foto cuenta como mensaje del chat (lo marca la base); el del vídeo del diario, como comentario de su vídeo');
  const noLe = await api.noLeidos(ana.id);
  check(Array.isArray(noLe), 'lo que el coach le ha escrito sin leer se consulta igual que antes');
  // La miniatura no llegó a subirse: el atleta puede quitarla (y solo quitarla)
  const [sinPoster] = await b.update('archivos', { poster_ruta: null }, { eq: { id: tecnica.id } });
  check(sinPoster.poster_ruta === null && await lanza(() => b.update('archivos', { poster_ruta: `${ana.id}/otra.jpg` }, { eq: { id: tecnica.id } })), 'si la miniatura falla al subir, se queda sin ella; otra no se le puede poner');
  const conv = await api.conversacion(ana.id);
  const ultimos = conv.slice(-2);
  check(conv.length === antes + 2 && ultimos[0].archivo?.tipo === 'adjunto' && ultimos[0].contexto?.nombre === null && ultimos[1].archivo?.tipo === 'video_tecnica' && ultimos[1].contexto?.nombre === 'vídeo'
    && conv.some((c) => c.contexto?.tipo === 'sesion' && c.contexto.nombre), 'el chat lo junta todo: los dos con su archivo, y los comentarios de sesiones con el nombre de la sesión');
  check(conv.every((c, i) => i === 0 || c.creado_en >= conv[i - 1].creado_en), 'del más antiguo al más reciente');
  check(!(await api.archivos(ana.id)).some((a) => a.tipo === 'adjunto') && (await api.archivos(ana.id, 'adjunto')).length === 1, 'los adjuntos no salen entre sus vídeos y fotos (solo si se piden)');
  const diarioAna = await api.diario(ana.id);
  const enDiario = diarioAna.find((a) => a.id === tecnica.id);
  check(enDiario && enDiario.comentarios === 1 && enDiario.respondido === false && !diarioAna.some((a) => a.tipo === 'adjunto'), 'el diario lista sus vídeos y fotos con cuántos comentarios tienen y si el coach ha contestado');
  const dest = await api.editarArchivo(tecnica.id, { destacado: true, nota_atleta: 'Mi mejor sentadilla' });
  check(dest.destacado === true && dest.nota_atleta === 'Mi mejor sentadilla', 'destaca un vídeo y le cambia el pie');
  check(await lanza(() => b.update('archivos', { revisado_en: new Date().toISOString() }, { eq: { id: tecnica.id } })), 'pero no puede darlo por revisado');

  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const convs = await api.conversaciones();
  const cAna = convs.find((x) => x.atleta.id === ana.id);
  check(convs[0].atleta.id === ana.id && cAna.sinLeer >= 2 && cAna.ultimo.id === vid.id, 'el coach ve la conversación de Ana la primera, con lo que tiene sin leer y su último mensaje');
  check((await api.mensajesSinLeer()) >= 2, 'y la insignia de Mensajes lo cuenta');
  const band = await api.bandeja();
  check(!band.archivos.some((a) => a.id === adjunto.id) && band.archivos.some((a) => a.id === tecnica.id), 'en Revisar, el vídeo de técnica sí está por revisar; la foto del chat, no');
  const resp = await api.enviarMensaje(ana.id, { texto: 'Rodilla bien. El vídeo lo miro esta tarde.', autor: 'coach' });
  check(resp.autor === 'coach' && !resp.archivo_id, 'contesta desde el chat (mensaje general)');
  const esp = await api.espacioUsado();
  check(esp.total > 0 && esp.lista[0].atleta.id === ana.id && esp.archivos >= 3, `el espacio usado se suma por atleta (${esp.archivos} archivos)`);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const conv2 = await api.conversacion(ana.id);
  check(conv2.at(-1).id === resp.id && conv2.filter((c) => c.archivoId === tecnica.id).length === 1, 'Ana ve la respuesta; el vídeo sale una vez (en su primer mensaje)');
  // El coach contestó dentro del hilo de la foto: al borrar la foto se van los dos mensajes
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const respFoto = await api.comentar({ atletaId: ana.id, archivoId: adjunto.id, texto: 'Esa rodilla, con hielo hoy', autor: 'coach' });
  check(respFoto.adjunto === true, 'la respuesta del coach a la foto también es un mensaje del chat');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.borrarArchivo(adjunto);
  check((await b.select('comentarios', { in: { id: [foto.id, respFoto.id] } })).length === 0 && !(await api.conversacion(ana.id)).some((c) => c.archivoId === adjunto.id),
    'al borrar la foto del chat se van sus mensajes (el suyo y la respuesta)');
  const foto2 = await api.enviarMensaje(ana.id, { texto: '', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  const adjunto2 = (await b.select('archivos', { eq: { id: foto2.archivo_id } }))[0];
  check(foto2.texto === 'Foto', 'una foto sin texto lleva «Foto» como texto');
  await api.borrarMensaje((await api.conversacion(ana.id)).find((c) => c.id === foto2.id));
  check(!(await api.conversacion(ana.id)).some((c) => c.id === foto2.id) && (await b.select('archivos', { eq: { id: adjunto2.id } })).length === 0, 'borra su mensaje con la foto, y la foto se va con él');
  check(await lanza(() => api.borrarMensaje({ id: resp.id })) || (await b.select('comentarios', { eq: { id: resp.id } })).length === 1, 'pero no puede borrar los del coach');
  await api.borrarArchivo(tecnica);
}

console.log('\nFoto de perfil y nombre (v0.19)');
{
  const jpg = 'data:image/jpeg;base64,' + '/9j/'.repeat(300);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const p = await api.cambiarFoto(jpg);
  check(p.foto === jpg && (await api.perfil()).foto === jpg, 'Ana guarda su foto de perfil');
  check(await lanza(() => api.cambiarFoto('data:image/png;base64,AAAA')) && await lanza(() => api.cambiarFoto('data:image/jpeg;base64,' + 'A'.repeat(80001))), 'la app no manda una foto que la base rechazaría');
  check((await api.fotoCoach()) === null, 'su coach aún no tiene foto: el chat enseña el lobo');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const n = await api.cambiarNombre('  Pelayo   Fernández ');
  check(n.nombre === 'Pelayo Fernández' && await lanza(() => api.cambiarNombre('   ')), 'el coach cambia su nombre (el que ven los atletas); vacío, no');
  await api.cambiarFoto(jpg);
  const lista = await api.atletas();
  check(lista.find((a) => a.id === ana.id)?.foto === jpg && lista.filter((a) => a.id !== ana.id).every((a) => a.foto === null), 'la lista de atletas trae la foto de Ana (y nada en los que no tienen)');
  check((await api.resumenes()).find((r) => r.atleta_id === ana.id)?.foto === jpg, 'y el panel también');
  check((await api.ficha(ana.id)).atleta.foto === jpg, 'y su ficha');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.fotoCoach()) === jpg, 'Ana ve la foto de su coach');
  await api.cambiarFoto(null);
  check((await api.perfil()).foto === null, 'y puede quitar la suya');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.cambiarFoto(null);
}

console.log('\nRegistro de errores (v0.21)');
{
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.registrarError({ mensaje: 'TypeError: falla algo', pantalla: 'carga #hoy', version: '0.21' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const errs = await api.erroresApp();
  check(errs.length === 1 && errs[0].quien === ana.nombre && errs[0].pantalla === 'carga #hoy', 'un error de Ana le llega al coach con su nombre y la pantalla');
  await api.borrarErroresApp();
  check((await api.erroresApp()).length === 0, 'y los puede borrar');
}

console.log('\nControl de cobros (v0.24)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.guardarAcuerdoCobro(ana.id, { servicio: 'Performance', precio_mes: 75, ciclo: 'trimestral', desde: '2026-07-20', nota: 'Descuento de amiga' });
  const p1 = await api.guardarPago({ atleta_id: ana.id, periodo_desde: '2026-07-20', periodo_hasta: '2026-10-19', importe: 225, estado: 'pagado', fecha_pago: '2026-07-21', metodo: 'transferencia' });
  const p2 = await api.guardarPago({ atleta_id: ana.id, periodo_desde: '2026-10-20', periodo_hasta: '2027-01-19', importe: 225, estado: 'pendiente', fecha_pago: '2026-10-20' });
  const c = await api.cobrosAtleta(ana.id);
  check(c.acuerdo.precio_mes == 75 && c.acuerdo.ciclo === 'trimestral' && c.pagos.length === 2 && c.pagos[0].id === p2.id && p2.fecha_pago === null, 'el coach guarda lo acordado y apunta cobros (un pendiente no lleva fecha de pago)');
  await api.marcarPagado(p2.id, { metodo: 'bizum' });
  const p2b = (await api.cobrosAtleta(ana.id)).pagos.find((x) => x.id === p2.id);
  check(p2b.estado === 'pagado' && p2b.fecha_pago === hoyISO() && p2b.metodo === 'bizum', '«Marcar pagado hoy» con su método');
  await api.guardarAcuerdoCobro(ana.id, { precio_mes: 89, ciclo: 'trimestral' });
  check(Number((await api.cobrosAtleta(ana.id)).pagos.find((x) => x.id === p1.id).importe) === 225, 'si cambias el precio, lo ya apuntado no cambia');
  const enPanel = (await api.resumenes()).find((r) => r.atleta_id === ana.id);
  check(enPanel?.cobro?.pagadoHasta === '2027-01-19' && enPanel.cobro.estado === 'al_dia', 'en el panel de atletas, cómo va cada uno con los pagos');
  const todos = await api.cobrosTodos();
  check(todos.filas.some((x) => x.atleta.id === ana.id && x.pagadoHasta === '2027-01-19') && typeof todos.cobradoMes === 'number', 'en Cuenta, todos de un vistazo (Ana, pagado hasta el 19 ene)');
  const exp = await api.exportar(ana.id);
  check(!('pagos' in exp) && !('cobros_atletas' in exp) && (await api.copiaCompleta()).pagos.length >= 2, 'van en la copia completa, pero no en la descarga de un atleta (es la que se le da a él)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const deAna = await api.cobrosAtleta(ana.id).catch(() => ({ acuerdo: null, pagos: [] }));
  check(!deAna.acuerdo && deAna.pagos.length === 0 && !('pagos' in (await api.exportar(ana.id))), 'Ana no los ve: ni en la app ni en su descarga de datos');
  check(await lanza(() => api.guardarPago({ atleta_id: ana.id, periodo_desde: '2026-11-01', periodo_hasta: '2026-11-30', importe: 0, estado: 'pagado' })), 'ni puede apuntarse un pago');
  const mio = await api.miCobro();
  check(mio && mio.pagadoHasta === '2027-01-19' && mio.debe === 0 && Object.keys(mio).join() === 'pagadoHasta,debe,debeDesde,estado', `solo ve cómo va (v0.25): pagado hasta ${mio?.pagadoHasta}, ${mio?.estado}`);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.borrarPago(p1.id);
  check((await api.cobrosAtleta(ana.id)).pagos.length === 1, 'el coach borra un cobro apuntado por error');
}

console.log('\nPreparar el mes de golpe (v0.23)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const pl = await api.copiarBloque((await api.plantillas())[0].id, { nombre: 'Prueba mes' });
  const c = await api.bloqueCompleto(pl.id);
  const w1 = c.semanas.sort((x, y) => x.numero - y.numero)[0];
  const ses1 = c.sesiones[w1.id] || [];
  const p1 = (c.pautas[ses1[0]?.id] || [])[0];
  if (p1) await b.sql(`update sesion_ejercicios set carga_sugerida_kg = 60, rpe_objetivo = null where id = $1`, [p1.id]);
  const nuevas = await api.prepararSemanas(w1.id, { n: 3, kg: 'salto', rpe: 0.5, descargaUltima: true });
  check(nuevas.length === 3 && nuevas.every((w) => w.programacion !== 'programada'), 'tres semanas nuevas, en borrador');
  const c2 = await api.bloqueCompleto(pl.id);
  const cargaEn = (w) => { const s0 = (c2.sesiones[w.id] || []).find((x) => x.orden === ses1[0].orden); return (c2.pautas[s0?.id] || []).find((x) => x.orden === p1.orden)?.carga_sugerida_kg; };
  const kgs = nuevas.map((w) => Number(cargaEn(w)));
  const ultima = c2.semanas.find((w) => w.id === nuevas[2].id);
  check(kgs[0] > 60 && kgs[1] > kgs[0] && kgs[2] < kgs[1] && ultima.foco === 'descarga', `cada una sale de la anterior y la última es de descarga (60 → ${kgs.join(' → ')} kg)`);
  // Una semana vacía que ya era de descarga (y publicada por error): se rellena como descarga y en borrador
  const ult = c2.semanas.find((w) => w.id === nuevas[2].id);
  const [vacia] = await b.sql(`insert into semanas (bloque_id, numero, foco, programacion) values ($1, $2, 'descarga', 'programada') returning id`, [pl.id, ult.numero + 1]);
  await b.sql(`update semanas set foco = null where id = $1`, [ult.id]);
  const [rellena] = await api.prepararSemanas(ult.id, { n: 1, kg: 'salto', rpe: 0.5 });
  const c3 = await api.bloqueCompleto(pl.id);
  const wR = c3.semanas.find((w) => w.id === rellena.id);
  const kgR = (() => { const s0 = (c3.sesiones[wR.id] || []).find((x) => x.orden === ses1[0].orden); return Number((c3.pautas[s0?.id] || []).find((x) => x.orden === p1.orden)?.carga_sugerida_kg); })();
  check(rellena.id === vacia.id && wR.programacion !== 'programada' && wR.foco === 'descarga' && kgR < kgs[2], `una semana vacía que ya era de descarga se rellena como descarga y en borrador (${kgs[2]} → ${kgR} kg)`);
  await api.borrar('bloques', pl.id);
}

console.log('\nServicio y nivel (v0.22)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const nuevo = await api.crearAtleta({ nombre: 'Prueba Nivel', nivel: 'avanzado', nutricion: false });
  check(nuevo.nivel === 'avanzado' && nuevo.nutricion === false, 'al darlo de alta, el coach elige su nivel y que solo le lleva el entrenamiento');
  const normal = await api.crearAtleta({ nombre: 'Prueba Normal' });
  check(normal.nivel === null && normal.nutricion === true, 'sin elegir nada, como siempre: con nutrición y sin nivel');
  await api.actualizarAtleta(ana.id, { nutricion: false, nivel: 'intermedio' });
  const resAna = (await api.resumenes()).find((r) => r.atleta_id === ana.id);
  check(resAna && !(resAna.alertas || []).some((x) => /nutric|kcal|comid/i.test(x.texto || '')), 'a quien no le lleva la nutrición, el panel no le avisa de nada de nutrición');
  check((await api.funcionesAtleta(ana.id)).conNutricion === false, 'y en «lo que le pide la app» sabe que no se la lleva (el plan sigue guardado)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const yo = await api.miAtleta();
  check(yo.nutricion === false && yo.nivel === 'intermedio', 'Ana lee su ficha (la app oculta su nutrición)');
  const dia = await api.tuDia(ana.id, { salud: true, nutricion: false });
  check(!dia.some((x) => x.id === 'nutricion'), 'y en «Tu día» no aparece la nutrición');
  await api.actualizarAtleta(ana.id, { nutricion: true, nivel: 'novato' }).catch(() => null);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const trasIntento = (await api.ficha(ana.id)).atleta;
  check(trasIntento.nutricion === false && trasIntento.nivel === 'intermedio', 'y no puede cambiarse ni el servicio ni el nivel');
  await api.actualizarAtleta(ana.id, { nutricion: true, nivel: null });
  for (const x of [nuevo, normal]) await api.borrarAtleta(x.id);
}

console.log('\nRecetas, recetario y menú; solo nutrición (v0.26)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const porridge = await api.guardarReceta({ nombre: 'Porridge de avena', tomas: ['desayuno'], raciones: 1, kcal: '505', proteina_g: 38, carbos_g: 72, grasa_g: 7, ingredientes: '50 g de copos de avena\n200 ml de leche\n1 plátano\nCanela al gusto', preparacion: 'Calienta la leche con la avena.' });
  const curry = await api.guardarReceta({ nombre: 'Pollo al curry', tomas: ['comida', 'cena'], raciones: 2, kcal: 525, proteina_g: 42, carbos_g: 62, grasa_g: 12, ingredientes: '300 g de pollo\n140 g de arroz' });
  check(porridge.ingredientes.length === 4 && porridge.ingredientes[0].cantidad === 50 && porridge.kcal == 505, 'el coach crea una receta pegando los ingredientes como texto (uno por línea)');
  check(await lanza(() => api.guardarReceta({ nombre: '' })), 'sin nombre no se guarda');
  await api.asignarReceta(ana.id, porridge.id, 'desayuno', { factor: 1.5, nota: 'Si entrenas por la mañana, el plátano después' });
  await api.asignarReceta(ana.id, curry.id, ['comida', 'cena']);
  await api.asignarReceta(ana.id, curry.id, 'comida', { factor: 1.25 });
  await api.asignarReceta(ana.id, porridge.id, 'desayuno');
  let rec0 = await api.recetario(ana.id);
  check(rec0.porToma.comida[0].factor == 1 && rec0.porToma.desayuno[0].factor == 1.5 && /plátano/.test(rec0.porToma.desayuno[0].nota || ''),
    'asignarla otra vez en una toma donde ya la tiene no la toca (ni su factor ni tu nota)');
  await api.cambiarAsignacion(rec0.porToma.comida[0].id, { factor: 1.25 });
  const lista = await api.recetas();
  check(lista.find((r) => r.id === curry.id)?.atletas === 1 && !('foto' in lista[0]), 'su biblioteca de recetas, sin la foto grande, con a cuántos atletas se la ha puesto');
  let rec = await api.recetario(ana.id);
  check(rec.porToma.desayuno?.[0].factor == 1.5 && rec.porToma.comida?.[0].factor == 1.25 && rec.porToma.cena?.length === 1 && rec.asignaciones.length === 3, 'en su recetario por toma (sin duplicar); el factor se cambia en la asignación');
  check(rec.tomas.join() === 'desayuno,comida,merienda,cena' && rec.eligio === false, 'sin elegir sus comidas, las cuatro de siempre');

  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  rec = await api.recetario(ana.id);
  check(rec.recetas.length === 2 && rec.porToma.desayuno[0].receta.nombre === 'Porridge de avena', 'Ana ve su recetario con las recetas');
  await api.guardarComidas(ana.id, ['cena', 'desayuno', 'comida']);
  rec = await api.recetario(ana.id);
  check(rec.tomas.join() === 'desayuno,comida,cena' && rec.eligio, 'elige que hace tres comidas al día');
  const aDes = rec.porToma.desayuno[0];
  const e1 = await api.apuntarMenu(ana.id, { fecha: lunes, toma: 'desayuno', asignacion: aDes, raciones: 1 });
  check(Number(e1.kcal) === 757.5 && e1.texto === 'Porridge de avena', 'añade el porridge al lunes: con sus kcal ya con su factor (505 × 1,5)');
  await api.apuntarMenu(ana.id, { fecha: lunes, toma: 'comida', asignacion: rec.porToma.comida[0], raciones: 2 });
  await api.apuntarMenu(ana.id, { fecha: sumarDias(lunes, 1), toma: 'cena', texto: 'Cena fuera', macros: { kcal: 800 } });
  const otra = await (async () => { await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach'); const r = await api.guardarReceta({ nombre: 'No es suya', tomas: ['cena'] }); await b.auth.entrar('ana@test', 'contraseña-ana-1'); return r; })();
  check(await lanza(() => api.apuntarMenu(ana.id, { fecha: lunes, toma: 'cena', asignacion: { receta: otra, factor: 1 } })), 'una receta que no está en su recetario no entra en su menú');
  let menu = await api.menuSemana(ana.id, lunes);
  check(menu.length === 3, 'su menú de la semana');
  const comida = menu.find((x) => x.toma === 'comida');
  const cambiada = await api.cambiarMenu(comida, { raciones: 1 });
  check(Number(cambiada.kcal) === Math.round(525 * 1.25 * 10) / 10 && Number(cambiada.raciones) === 1, 'cambiar las raciones recalcula sus kcal');
  await api.cambiarMenu(e1, { hecho: true });
  const copiadas = await api.copiarMenuSemana(ana.id, lunes, sumarDias(lunes, 7));
  check(copiadas.length === 3 && copiadas.every((x) => !x.hecho) && (await api.menuSemana(ana.id, sumarDias(lunes, 7))).length === 3, 'repite el menú la semana siguiente (sin marcar como comido)');
  check((await api.copiarMenuSemana(ana.id, lunes, sumarDias(lunes, 7))).length === 0 && (await api.menuSemana(ana.id, sumarDias(lunes, 7))).length === 3, 'copiarla dos veces no duplica nada');
  await api.vaciarMenuSemana(ana.id, sumarDias(lunes, 7));
  check((await api.menuSemana(ana.id, sumarDias(lunes, 7))).length === 0, 'y la vacía');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const deCurry = (await api.recetario(ana.id)).asignaciones.filter((a) => a.receta_id === curry.id);
  for (const a of deCurry) await api.quitarReceta(a.id);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const sinCurry = await api.copiarMenuSemana(ana.id, lunes, sumarDias(lunes, 7));
  check(sinCurry.length === 3 && sinCurry.find((x) => x.texto === 'Pollo al curry').receta_id === null && sinCurry.find((x) => x.toma === 'desayuno').receta_id === porridge.id,
    'si su coach le ha quitado una receta, la semana se copia igual (esa, como texto)');
  await api.vaciarMenuSemana(ana.id, sumarDias(lunes, 7));
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.asignarReceta(ana.id, curry.id, 'comida', { factor: 1.25 });
  await api.asignarReceta(ana.id, curry.id, 'cena');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const dia = await api.tuDia(ana.id, { salud: true, hoy: lunes });
  check(dia.some((x) => x.id === 'menu'), '«Tu día» del lunes le recuerda su menú');
  await api.pedirCambioReceta(aDes.id, 'Sin plátano, por favor');
  check(await lanza(() => api.cambiarAsignacion(aDes.id, { factor: 3 })), 'no puede cambiarse el factor');
  await api.recetaFavorita(aDes.id, true);

  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const bandeja = await api.bandeja();
  check(bandeja.recetas.length === 1 && bandeja.recetas[0].receta.nombre === 'Porridge de avena' && bandeja.recetas[0].cambio_nota === 'Sin plátano, por favor' && bandeja.porAtleta[ana.id] >= 1,
    'en Revisar le sale la receta que Ana pide cambiar, con su nota');
  check((await api.resumenes()).find((r) => r.atleta_id === ana.id).alertas.some((a) => a.tipo === 'receta'), 'y en el panel');
  await api.resolverCambioReceta(aDes.id);
  check((await api.bandeja()).recetas.length === 0 && (await api.recetario(ana.id)).porToma.desayuno[0].favorita === true, 'la da por resuelta (su favorita sigue)');
  const exp = await api.exportar(ana.id);
  check(exp.menu_comidas.length === 3 && exp.recetas_atleta.length === 3 && exp.recetas.length === 2 && exp.comidas_atleta.length === 1, 'su descarga de datos lleva su menú, su recetario (con las recetas) y sus comidas');
  const copia = await api.copiaCompleta();
  check(copia.recetas.length >= 3 && copia.menu_comidas.length === 3, 'y la copia completa, todo');
  const dup = await api.duplicarReceta(curry.id);
  check(dup.nombre === 'Pollo al curry (copia)' && dup.ingredientes.length === 2, 'duplicar una receta (para cambiarle algo a alguien sin tocar la original)');
  await api.borrarReceta(dup.id);
  await api.borrarReceta(otra.id);

  // v0.27: días sin merienda
  await api.guardarComidas(ana.id, ['desayuno', 'comida', 'merienda', 'cena'], 'merienda');
  const asigSin = await api.asignarReceta(ana.id, curry.id, 'comida', { factor: 1.25, variante: 'sin' });
  let recV = await api.recetario(ana.id);
  check(recV.opcional === 'merienda' && asigSin.length === 1 && recV.porToma.comida.filter((a) => a.receta_id === curry.id).length === 2
    && (await api.asignarReceta(ana.id, curry.id, 'comida', { variante: 'sin' })).length === 0,
    'el coach marca la merienda como opcional y pone el curry también para los días sin merienda (×1,25), una sola vez');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const lunesV = sumarDias(lunes, 14);
  await api.marcarDiaSin(ana.id, sumarDias(lunesV, 6), true);
  await api.marcarDiaSin(ana.id, sumarDias(lunesV, 6), true);
  check((await api.diasSin(ana.id, lunesV)).join() === sumarDias(lunesV, 6), 'Ana marca el domingo sin merienda (dos veces no duplica)');
  await api.guardarComidas(ana.id, ['desayuno', 'comida', 'merienda', 'cena']);
  check((await api.recetario(ana.id)).opcional === 'merienda', 'al guardar sus comidas, la opcional se queda como la puso su coach');
  await api.apuntarMenu(ana.id, { fecha: sumarDias(lunesV, 6), toma: 'comida', asignacion: { ...recV.porToma.comida.find((a) => a.variante === 'sin'), receta: curry } });
  await api.copiarMenuSemana(ana.id, lunesV, sumarDias(lunesV, 7));
  check((await api.diasSin(ana.id, sumarDias(lunesV, 7))).join() === sumarDias(lunesV, 13), 'copiar la semana copia también sus días sin merienda');
  await api.vaciarMenuSemana(ana.id, sumarDias(lunesV, 7));
  check((await api.diasSin(ana.id, sumarDias(lunesV, 7))).length === 0, 'y vaciarla los quita');
  await api.marcarDiaSin(ana.id, sumarDias(lunesV, 6), false);
  check((await api.diasSin(ana.id, lunesV)).length === 0, 'y lo desmarca');
  await api.vaciarMenuSemana(ana.id, lunesV);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  for (const a of (await api.recetario(ana.id)).asignaciones.filter((x) => x.variante)) await api.quitarReceta(a.id);
  await api.guardarComidas(ana.id, ['desayuno', 'comida', 'merienda', 'cena'], null);

  // Solo nutrición
  const lucia = await api.crearAtleta({ nombre: 'Lucía Solo Nutrición', entrenamiento: false });
  check(lucia.entrenamiento === false && lucia.nutricion === true, 'da de alta a quien solo le lleva la nutrición');
  check(await lanza(() => api.actualizarAtleta(lucia.id, { nutricion: false })), 'y no se puede quedar sin nada');
  const rL = (await api.resumenes()).find((r) => r.atleta_id === lucia.id);
  check(rL.servicio === 'nutricion' && !rL.alertas.some((a) => ['sin_bloque', 'sin_entrenar', 'publicar'].includes(a.tipo)), 'en el panel, sin avisos de entrenamiento');
  await api.borrarAtleta(lucia.id);
}

console.log('\nCoach: verificación en dos pasos');
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
const factor = await b.auth.mfa.inscribir('Móvil');
await b.auth.mfa.verificar(factor.id, '123456');
await api.exigirDosPasos(true);
check((await b.auth.mfa.nivel()).actual === 'aal2' && (await api.perfil()).exige_2fa === true, 'activa la verificación con su app y la base pasa a exigirla');
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
const nivel = await b.auth.mfa.nivel();
check(nivel.actual === 'aal1' && nivel.siguiente === 'aal2', 'al volver a entrar, la app sabe que falta el segundo paso');
check((await api.atletas()).length === 0, 'y sin él la base de datos no le da nada');
check(await lanza(() => api.exigirDosPasos(false)), 'con solo la contraseña no puede dejar de exigirla');
check(await lanza(() => b.auth.mfa.verificar(factor.id, '000000')), 'un código erróneo no vale');
await b.auth.mfa.verificar(factor.id, '123456');
check((await api.atletas()).length === 1, 'con el código, vuelve a ver a sus atletas');
await api.exigirDosPasos(false);
await b.auth.mfa.quitar(factor.id);
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
check((await api.atletas()).length === 1, 'si la desactiva (quitando el último dispositivo con el segundo paso hecho), vuelve a entrar solo con la contraseña');

console.log('\nCoach: borrar un atleta con sus archivos');
await b.auth.entrar('ana@test', 'contraseña-ana-1');
const suelto = await api.subirArchivo(ana.id, new Blob(['otro'], { type: 'video/mp4' }), { tipo: 'video_tecnica' });
await b.delete('archivos', { eq: { id: suelto.id } });
await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
check((await b.sql(`select count(*)::int n from storage.objects`))[0].n === 2, 'un archivo que la atleta borró solo de la tabla sigue en su carpeta');
// v0.23: antes de borrarla, la copia completa (para recuperarla después)
const copiaAntes = JSON.parse(JSON.stringify(await api.copiaCompleta()));
const TABLAS_ANA = ['pagos', 'cobros_atletas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'bloques', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos', 'notas_ejercicio', 'habitos', 'registros_habito', 'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'comentarios'];
const cuenta = async () => Object.fromEntries(await Promise.all(TABLAS_ANA.map(async (t) => [t, (await b.sql(`select count(*)::int n from ${t} where atleta_id = $1`, [ana.id]))[0].n])));
const antes = await cuenta();
await api.borrarAtleta(ana.id);
const notisAntes = (await b.sql(`select count(*)::int n from notificaciones`))[0].n;
check((await b.sql(`select count(*)::int n from storage.objects`))[0].n === 0, 'el borrado completo vacía su carpeta de Storage, también lo que no estaba registrado');
check((await api.atletas()).length === 0, 'y su ficha con todo lo demás');

console.log('\nRecuperar una atleta borrada desde la copia completa (v0.23)');
{
  await import('../scripts/restaurar-atleta.js'); // script clásico (la página lo carga con <script src>): deja FBERestaurar
  const R = globalThis.FBERestaurar;
  check(R.atletasDe(copiaAntes).some((x) => x.id === ana.id && x.nombre === ana.nombre), 'la página lee la copia y ofrece a sus atletas');
  const { sql, resumen } = R.generarSql(copiaAntes, ana.id);
  check(resumen.series > 0 && resumen.sesion_ejercicios > 0 && /^begin;$/m.test(sql) && /^commit;$/m.test(sql), `el SQL va en una transacción (${resumen.series} series, ${resumen.bloques} bloques, ${resumen.comentarios} mensajes)`);
  await b.guion(sql);
  const despues = await cuenta();
  const iguales = TABLAS_ANA.filter((t) => despues[t] !== antes[t]);
  check(iguales.length === 0, iguales.length ? `difieren: ${iguales.map((t) => `${t} ${antes[t]}→${despues[t]}`).join(', ')}` : 'vuelve todo lo suyo, tabla a tabla, tal y como estaba');
  check((await b.sql(`select count(*)::int n from notificaciones`))[0].n === notisAntes, 'sin mandar notificaciones de cosas antiguas');
  const disp = await b.sql(`select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal and t.tgenabled = 'D'`);
  check(disp[0].n === 0, 'y con los disparadores de la app activos de nuevo');
  const [vuelta] = await b.sql(`select perfil_id from atletas where id = $1`, [ana.id]);
  check(vuelta?.perfil_id === copiaAntes.atletas.find((x) => x.id === ana.id).perfil_id, 'con su cuenta: Ana puede volver a entrar');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.miAtleta())?.id === ana.id && (await api.historial(ana.id)).length > 0, 'y ve su historial');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await b.guion(sql);
  check(JSON.stringify(await cuenta()) === JSON.stringify(antes), 'repetirlo no duplica nada');
  // Algo suyo borrado y vuelto a crear con otro id: lo de la copia no entra, pero el resto sí y no falla a medias
  const [w] = await b.sql(`select w.id, w.bloque_id, w.numero, w.fecha_inicio from semanas w join bloques k on k.id = w.bloque_id where k.atleta_id = $1 order by w.numero limit 1`, [ana.id]);
  const seriesAntes = (await b.sql(`select count(*)::int n from series where atleta_id = $1`, [ana.id]))[0].n;
  await b.sql(`delete from semanas where id = $1`, [w.id]);
  await b.sql(`insert into semanas (bloque_id, numero, fecha_inicio) values ($1, $2, $3)`, [w.bloque_id, w.numero, w.fecha_inicio]);
  await b.sql(`delete from pesos where atleta_id = $1`, [ana.id]);
  const res = await b.guion(sql);
  const comp = res[res.length - 1].rows[0];
  check((await b.sql(`select count(*)::int n from pesos where atleta_id = $1`, [ana.id]))[0].n === antes.pesos && Number(comp.filas_en_la_base) < Number(comp.filas_en_la_copia) && comp.recuperado == 1 && comp.con_cuenta === true,
    `con una semana vuelta a crear, recupera lo demás (sus pesos) sin fallar y lo dice: ${comp.filas_en_la_base} de ${comp.filas_en_la_copia} filas`);
  check((await b.sql(`select count(*)::int n from series where atleta_id = $1`, [ana.id]))[0].n <= seriesAntes, 'y no mete series sueltas de la semana que ya no está');
  check((() => { try { R.atletasDe({ atletas: copiaAntes.atletas }); return false; } catch (e) { return /copia completa/.test(e.message); } })(), 'solo acepta la copia completa del coach (la descarga de un atleta, no)');
}

console.log('\nBorrar semanas de un bloque (v0.27.7)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const bl = await api.nuevoBloque(ana.id, { nombre: 'Mes de prueba', fecha_inicio: '2026-11-02', semanas: 4, sesionesPorSemana: 1 });
  const ws = async () => (await api.bloqueCompleto(bl.id)).semanas.map((w) => [w.numero, w.fecha_inicio]);
  const [w1, w2, w3, w4] = (await api.bloqueCompleto(bl.id)).semanas;
  await api.borrarSemana(w1.id);
  check(JSON.stringify(await ws()) === JSON.stringify([[1, '2026-11-02'], [2, '2026-11-09'], [3, '2026-11-16']]), 'al borrar la semana 1, las demás suben un puesto y una semana antes');
  await api.borrarSemana(w2.id); await api.borrarSemana(w3.id);
  const solo = (await api.bloqueCompleto(bl.id)).semanas;
  check(solo.length === 1 && solo[0].id === w4.id && solo[0].numero === 1 && solo[0].fecha_inicio === '2026-11-02', 'borrando las 3 primeras, la que queda es la semana 1 y empieza con el bloque (antes seguía siendo la 4)');
  await b.sql(`update semanas set numero = 4, fecha_inicio = '2026-11-23' where id = $1`, [w4.id]);
  await api.renumerarSemanas(bl.id);
  check(JSON.stringify(await ws()) === JSON.stringify([[1, '2026-11-02']]), '«Renumerar desde la 1» arregla un bloque que se quedó con la semana 4 sola');
  const nueva = await api.nuevaSemana(bl.id);
  check(nueva.numero === 2 && nueva.fecha_inicio === '2026-11-09', 'y la siguiente que se añade es la 2');
}

console.log('\nLa última vez de cada ejercicio, para el editor (v0.27.8)');
{
  const [x] = await b.sql(`select p.ejercicio_id from series s join sesion_ejercicios p on p.id = s.sesion_ejercicio_id where s.atleta_id = $1 and s.sustituto_id is null limit 1`, [ana.id]);
  if (x) {
    const todas = await api.ultimasPorEjercicio(ana.id, [x.ejercicio_id], null);
    const ses = todas[x.ejercicio_id]?.sesion_id;
    const sinEsa = await api.ultimasPorEjercicio(ana.id, [x.ejercicio_id], [ses]);
    const antes = await api.ultimasPorEjercicio(ana.id, [x.ejercicio_id], [], '2000-01-01T00:00:00');
    check(ses && sinEsa[x.ejercicio_id]?.sesion_id !== ses && !antes[x.ejercicio_id],
      'excluye las sesiones que se le pasan (las de la semana que se mira) y lo registrado a partir de una fecha');
  } else check(false, 'Ana tiene series para probar «la última vez»');
}

console.log('\nPauta serie a serie (v0.28)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const bl = await api.nuevoBloque(ana.id, { nombre: 'Serie a serie', fecha_inicio: '2026-12-07', semanas: 1, sesionesPorSemana: 1 });
  const c = await api.bloqueCompleto(bl.id);
  const ses = c.sesiones[c.semanas[0].id][0];
  const [pa] = await b.insert('sesion_ejercicios', [{ sesion_id: ses.id, ejercicio_id: press.id, orden: 1, series: 3, reps_min: 8, reps_max: 8, carga_sugerida_kg: 60 }]);
  const cambios = await api.guardarDetalle(pa.id, [{ reps: 8, kg: 60, rpe: 7 }, { reps: 10, kg: '57,5', rpe: 8 }, { reps: 12, kg: 55, rpe: 9 }]);
  const [g] = await b.select('sesion_ejercicios', { eq: { id: pa.id } });
  check(g.series_detalle.length === 3 && g.series_detalle[1].kg === 57.5 && g.reps_min === 8 && g.reps_max === 12 && Number(g.carga_sugerida_kg) === 60 && Number(g.rpe_objetivo) === 9 && cambios.series === 3,
    'el coach guarda cada serie y el resumen de la pauta sale de ella');
  check(await lanza(() => api.guardarDetalle(pa.id, [{ reps: -1 }])), 'lo que no vale no se guarda (y lo dice)');
  const [nueva] = await api.prepararSemanas(c.semanas[0].id, { n: 1, kg: 'salto', rpe: 0, rir: 0, reps: 0 });
  const c2 = await api.bloqueCompleto(bl.id);
  const p2 = c2.pautas[c2.sesiones[nueva.id][0].id][0];
  check(JSON.stringify(p2.series_detalle.map((x) => x.kg)) === '[62.5,60,57.5]' && Number(p2.carga_sugerida_kg) === 62.5, '«Preparar las siguientes» sube cada serie a su manera');
  await api.guardarDetalle(pa.id, null);
  check((await b.select('sesion_ejercicios', { eq: { id: pa.id } }))[0].series_detalle === null, 'y se puede volver a series iguales');
  await api.borrar('bloques', bl.id);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
