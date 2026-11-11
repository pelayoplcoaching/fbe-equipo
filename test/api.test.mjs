// La capa de datos de la app (web/src/datos/api.js) contra el esquema real de Supabase con RLS.
// Recorre el flujo completo: el coach da de alta, programa y publica; el atleta activa, entrena y hace check-in.
import { crearPglite, crearBackendPglite } from './backend-pglite.mjs';
import { crearApi, VERSION_COMUNIDAD, cuboDe } from '../web/src/datos/api.js';
import { reenviable } from '../web/src/logica/chat.js';
import { VERSION_LEGAL } from '../web/src/legal.js';
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
check(cons.diasEntrenados === 1 && !('mapa' in cons), 'constancia: el día de hoy entrenado en las 12 semanas (v0.49: sin el mapa, que ya no usa nadie)');
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
// v0.50: las tarjetas de Semana (lo que trae cada sesión) y las semanas completas de la cabecera del perfil
const pautasS2 = await api.pautasSemana([sesS2.id, '00000000-0000-0000-0000-000000000000']);
check(pautasS2[sesS2.id].ejercicios === detS2.ejercicios.length && pautasS2[sesS2.id].minutos > 0 && pautasS2[sesS2.id].grupos.includes('pectoral') && pautasS2[sesS2.id].patrones.includes('empuje_h')
  && pautasS2['00000000-0000-0000-0000-000000000000'].ejercicios === 0 && Object.keys(await api.pautasSemana([])).length === 0, 'Semana: cada sesión con sus ejercicios, minutos, músculos y patrones (con permisos: lo suyo)');
check(Number.isInteger((await api.constancia(ana.id)).semanasCompletas), 'su constancia trae también las semanas completas en total');
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
check(JSON.stringify(await api.videosSesion(ana.id, [ePress.id])) === JSON.stringify({ [ePress.id]: 1 }) && JSON.stringify(await api.videosSesion(ana.id, [])) === '{}', 'cuenta los vídeos enviados de cada ejercicio de la sesión (v0.41)');

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
  check((await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [tecnica.poster_ruta])).length === 1 && await lanza(() => api.urlArchivo(tecnica.poster_ruta)),
    '(v0.54) la miniatura que deja de estar registrada: el atleta ya no la ve, y va a la cola de Storage');
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
  // El coach contestó dentro del hilo de la foto
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  // (v0.55, revisión) ya no «pegada» a la foto de Ana (saldría como si la mandara él): va al chat, citándola
  check(await lanza(() => api.comentar({ atletaId: ana.id, archivoId: adjunto.id, texto: 'Esa rodilla, con hielo hoy', autor: 'coach' })), '(033) el coach no pone en un mensaje suyo la foto que subió Ana');
  const respFoto = await api.enviarMensaje(ana.id, { texto: 'Esa rodilla, con hielo hoy', autor: 'coach', respondeA: foto.id });
  check(api.esMensaje(respFoto) && respFoto.responde_a === foto.id, 'la respuesta del coach a la foto es un mensaje del chat que la cita');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  // (v0.54, revisión de la 032) Una foto del chat con mensajes no se borra desde archivos (se saltaría las 48 horas y se
  // llevaría lo del coach): va por eliminar para todos, y lo del coach se queda
  await api.borrarArchivo(adjunto);
  check((await b.select('comentarios', { in: { id: [foto.id, respFoto.id] } })).length === 2 && !!(await api.urlArchivo(adjunto.ruta)), 'borrar la foto del chat «desde el diario» no hace nada (ni a sus mensajes)');
  const elF = await api.eliminarMensaje(foto);
  check(elF.estado === 'eliminado' && elF.almacenamiento === 'pendiente', 'Ana la elimina para todos: su archivo, a la cola (Storage no le deja borrar lo que ya no tiene fila)');
  check(await lanza(() => api.urlArchivo(adjunto.ruta)), 'y ya no la ve');
  const trasF = await b.select('comentarios', { in: { id: [foto.id, respFoto.id] } });
  check(trasF.find((c) => c.id === foto.id)?.eliminado_en && trasF.find((c) => c.id === respFoto.id)?.texto === 'Esa rodilla, con hielo hoy', 'su mensaje queda eliminado; la respuesta del coach se queda (sin la foto)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!!(await api.urlArchivo(adjunto.ruta)), 'el coach aún la tiene en Storage, hasta que vacía la cola');
  check((await api.limpiarAlmacenamiento()) >= 1 && (await b.sql(`select 1 from storage.objects where name = $1`, [adjunto.ruta])).length === 0, 'al abrir la app, la cola se vacía: fuera de Storage');
  check((await api.limpiarAlmacenamiento()) === 0, 'y no queda nada');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.limpiarAlmacenamiento()) === 0, '(un atleta no vacía la cola)');
  const foto2 = await api.enviarMensaje(ana.id, { texto: '', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  const adjunto2 = (await b.select('archivos', { eq: { id: foto2.archivo_id } }))[0];
  check(foto2.texto === 'Foto', 'una foto sin texto lleva «Foto» como texto');
  await api.eliminarMensaje(foto2);
  check((await api.conversacion(ana.id)).find((c) => c.id === foto2.id)?.eliminado_en && (await b.select('archivos', { eq: { id: adjunto2.id } })).length === 0, 'elimina su mensaje con la foto, y la foto se va con él');
  check(await lanza(() => api.eliminarMensaje({ id: resp.id })) && (await b.select('comentarios', { eq: { id: resp.id } })).length === 1, 'pero no puede eliminar los del coach');
  // El coach elimina una foto suya: la borra de Storage al momento (y, si Storage falla, lo dice y queda en la cola)
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const fotoC = await api.enviarMensaje(ana.id, { texto: 'Tu técnica', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'coach' });
  const rutaC = (await b.select('archivos', { eq: { id: fotoC.archivo_id } }))[0].ruta;
  const elC = await api.eliminarMensaje(fotoC);
  check(elC.almacenamiento === 'borrado' && (await b.sql(`select 1 from storage.objects where name = $1`, [rutaC])).length === 0, 'el coach elimina una foto suya: fuera de Storage al momento');
  const fotoC2 = await api.enviarMensaje(ana.id, { texto: 'Otra', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'coach' });
  const rutaC2 = (await b.select('archivos', { eq: { id: fotoC2.archivo_id } }))[0].ruta;
  const borrarReal = b.storage.borrar;
  b.storage.borrar = async () => { throw new Error('Sin conexión.'); };
  const elC2 = await api.eliminarMensaje(fotoC2);
  b.storage.borrar = borrarReal;
  check(elC2.almacenamiento === 'pendiente' && (await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [rutaC2])).length === 1, 'si Storage falla, queda en la cola (y la app lo avisa)');
  check((await api.limpiarAlmacenamiento()) >= 1 && (await b.sql(`select 1 from storage.objects where name = $1`, [rutaC2])).length === 0, 'y se reintenta al vaciarla');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
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
check((await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [suelto.ruta])).length === 1, '(v0.54) y en la cola de Storage: el atleta ya no lo ve ni lo borra');
// v0.48: una tarea suya hecha (con su respuesta) y otra de vídeo, que también tienen que volver
{
  const tVid = await api.ponerTarea(ana.id, { tipo: 'video', titulo: 'Vídeo del press', ejercicio_id: press.id, fecha: hoy });
  const tTxt = await api.ponerTarea(ana.id, { tipo: 'texto', titulo: '¿Qué tal?', fecha: hoy });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.completarTarea(tTxt.id, { respuesta: 'Bien' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!!tVid.id, 'antes de la copia, Ana tiene dos tareas (una hecha)');
}
// v0.23: antes de borrarla, la copia completa (para recuperarla después)
const copiaAntes = JSON.parse(JSON.stringify(await api.copiaCompleta()));
const TABLAS_ANA = ['pagos', 'cobros_atletas', 'recetas_atleta', 'comidas_atleta', 'menu_comidas', 'bloques', 'series', 'pesos', 'checkins', 'molestias', 'notas_coach', 'medidas', 'marcas', 'objetivos', 'notas_ejercicio', 'habitos', 'registros_habito', 'planes_nutricion', 'registros_nutricion', 'cuestionarios', 'comentarios', 'tareas'];
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
  // (v0.76) una semana sin series suyas y siempre la misma: con «order by numero» sin más, el orden entre bloques no estaba
  // fijado y, al cambiar la tabla atletas (migración 046), salía la semana con sus series y las pruebas siguientes se quedaban sin ellas
  const [w] = await b.sql(`select w.id, w.bloque_id, w.numero, w.fecha_inicio from semanas w join bloques k on k.id = w.bloque_id where k.atleta_id = $1
    and not exists (select 1 from sesiones s join sesion_ejercicios p on p.sesion_id = s.id join series x on x.sesion_ejercicio_id = p.id where s.semana_id = w.id)
    order by w.numero, w.fecha_inicio, w.id limit 1`, [ana.id]);
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

{
  console.log('Variantes de material (v0.30)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const maq = await api.crear('ejercicios', { nombre: 'Press militar en máquina/inverso', grupos_musculares: ['deltoides'] });
  const manc = await api.crear('ejercicios', { nombre: 'Press militar sentado con mancuernas', grupos_musculares: ['deltoides'], alternativas: [maq.id] });
  const bl = await api.nuevoBloque(ana.id, { nombre: 'Variantes', fecha_inicio: '2027-01-04', semanas: 2, sesionesPorSemana: 1 });
  const c = await api.bloqueCompleto(bl.id);
  const [w1, w2] = c.semanas;
  const s1 = c.sesiones[w1.id][0];
  const s2 = c.sesiones[w2.id]?.[0] || await api.nuevaSesion(w2.id);
  await b.insert('sesion_ejercicios', [
    { sesion_id: s1.id, ejercicio_id: manc.id, orden: 1, series: 3, variante: 'En máquina' },
    { sesion_id: s2.id, ejercicio_id: manc.id, orden: 1, series: 3, variante: 'En máquina' },
    { sesion_id: s2.id, ejercicio_id: manc.id, orden: 2, series: 3, variante: 'Mancuernas/Máquina' },
    { sesion_id: s2.id, ejercicio_id: maq.id, orden: 3, series: 3, variante: 'Agarre neutro' },
  ]);
  let lista = (await api.variantesPorRevisar()).filter((x) => x.bloque.id === bl.id);
  check(lista.length === 1 && lista[0].pautas === 2 && lista[0].atleta.id === ana.id && lista[0].revision.propuestas[0]?.id === maq.id,
    'encuentra la variante con otro material (una vez por bloque) y propone el ejercicio de ese material; «Mancuernas/Máquina» es a elegir y no cuenta');
  const n = await api.corregirVariante({ bloqueId: bl.id, ejercicioId: manc.id, variante: 'En máquina', nuevoEjercicioId: maq.id });
  const filas = await b.select('sesion_ejercicios', { in: { sesion_id: [s1.id, s2.id] }, order: [['orden', 'asc']] });
  check(n === 2 && filas.filter((f) => f.ejercicio_id === maq.id && f.variante === null).length === 2 && filas.some((f) => f.variante === 'Mancuernas/Máquina' && f.ejercicio_id === manc.id),
    'la cambia en todas las semanas del bloque por el ejercicio que cuadra y sin la variante; lo demás no lo toca');
  lista = (await api.variantesPorRevisar()).filter((x) => x.bloque.id === bl.id);
  check(lista.length === 0, 'y deja de salir');
  await b.insert('sesion_ejercicios', [{ sesion_id: s1.id, ejercicio_id: manc.id, orden: 5, series: 3, variante: 'En máquina Technogym de discos' }]);
  await api.corregirVariante({ bloqueId: bl.id, ejercicioId: manc.id, variante: 'En máquina Technogym de discos', nuevoEjercicioId: maq.id });
  const [t] = await b.select('sesion_ejercicios', { eq: { sesion_id: s1.id, orden: 5 } });
  check(t.ejercicio_id === maq.id && t.variante === 'En máquina Technogym de discos', 'si la variante dice algo más que el material, se queda');
  await b.insert('sesion_ejercicios', [{ sesion_id: s1.id, ejercicio_id: manc.id, orden: 6, series: 3, variante: 'Con barra' }]);
  await api.corregirVariante({ bloqueId: bl.id, ejercicioId: manc.id, variante: 'Con barra' });
  const [q] = await b.select('sesion_ejercicios', { eq: { sesion_id: s1.id, orden: 6 } });
  check(q.ejercicio_id === manc.id && q.variante === null, '«Quitar la variante» deja el ejercicio y quita la variante');
  await api.actualizar('bloques', bl.id, { estado: 'finalizado' });
  await b.insert('sesion_ejercicios', [{ sesion_id: s1.id, ejercicio_id: manc.id, orden: 7, series: 3, variante: 'En máquina' }]);
  check(await lanza(() => api.corregirVariante({ bloqueId: bl.id, ejercicioId: manc.id, variante: 'En máquina', nuevoEjercicioId: maq.id }))
    && (await api.variantesPorRevisar()).every((x) => x.bloque.id !== bl.id), 'un bloque cerrado no se toca ni sale en la lista');
  await api.borrar('bloques', bl.id);
}

{
  console.log('Subir sin cobertura y reintentar (v0.33)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const f = new Blob(['vídeo largo'], { type: 'video/mp4' });
  const ruta = api.rutaArchivo(ana.id, f, { tipo: 'video_tecnica', fecha: '2026-10-29' });
  const original = b.storage.subir;
  let llamadas = 0;
  b.storage.subir = async (...x) => { llamadas++; if (llamadas === 1) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; } return original.apply(b.storage, x); };
  let err = null;
  try { await api.subirArchivo(ana.id, f, { tipo: 'video_tecnica', ruta }); } catch (e) { err = e; }
  const tras1 = await b.select('archivos', { eq: { ruta } });
  check(err?.sinConexion && err.ruta === ruta && tras1.length === 1, 'sin cobertura, el registro se queda (con su ruta) para el siguiente intento');
  const a = await api.subirArchivo(ana.id, f, { tipo: 'video_tecnica', ruta });
  const tras2 = await b.select('archivos', { eq: { ruta } });
  check(a.id === tras1[0].id && tras2.length === 1 && tras2[0].fecha === '2026-10-29', 'al reintentar con la misma ruta no se duplica, y conserva el día en que se grabó');
  b.storage.subir = async () => { throw new Error('Permiso denegado'); };
  const ruta2 = api.rutaArchivo(ana.id, f, { tipo: 'video_tecnica' });
  check(await lanza(() => api.subirArchivo(ana.id, f, { tipo: 'video_tecnica', ruta: ruta2 })) && (await b.select('archivos', { eq: { ruta: ruta2 } })).length === 0, 'si el servidor lo rechaza (no es la cobertura), el registro se borra');
  b.storage.subir = original;
  await api.descartarSubida(ruta);
  check((await b.select('archivos', { eq: { ruta } })).length === 0, 'descartar un envío pendiente borra su registro');
}


console.log('Modo atleta del coach (v0.37)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.miAtleta()) == null, 'el coach no tiene ficha de atleta hasta que la crea');
  const antes = (await api.atletas()).length;
  const propio = await api.crearAtletaPropio();
  check(propio.perfil_id === coachId && propio.nutricion === false, 'el coach crea su ficha vinculada a su cuenta, sin nutrición');
  check((await api.crearAtletaPropio()).id === propio.id, 'crearla otra vez devuelve la misma');
  check((await api.miAtleta())?.id === propio.id, 'miAtleta() devuelve su ficha');
  const lista = await api.atletas();
  check(lista.length === antes && !lista.some((a) => a.id === propio.id), 'su ficha no sale en la lista de atletas');
  check(!(await api.cobrosTodos()).filas.some((f) => f.atleta.id === propio.id), 'ni en cobros');
  const bp = await api.nuevoBloque(propio.id, { nombre: 'Mi fuerza', foco: 'adaptacion', fecha_inicio: lunes, semanas: 2, sesionesPorSemana: 2 });
  check((await api.bloqueCompleto(bp.id)).semanas.length === 2, 'se programa un bloque como a cualquiera');
  check((await api.programa(propio.id)) != null, 'y lo ve como su programa');
  const cons = (await api.consentimientos()).map((c) => c.tipo).sort();
  check(JSON.stringify(cons) === '["datos_salud","privacidad"]', 'al crear su ficha quedan sus consentimientos (una vez)');
  const cp = await api.bloqueCompleto(bp.id); const sp = cp.sesiones[cp.semanas[0].id][0];
  await api.guardarPreparacion(sp.id, { sueno: 2, energia: 3, molestias: 1 });
  check((await api.sesion(sp.id, propio.id)).sesion.preparacion?.energia === 3, 'y se guarda cómo llega a su sesión (sueño, energía, molestias)');
}

console.log('Peso a diario o una vez a la semana (v0.40, migración 026)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [fichaAna] = await b.select('atletas', { eq: { id: ana.id } });
  check(fichaAna.peso_frecuencia === 'diario', 'de entrada, el peso se pide a diario');
  const conPeso = await api.tuDia(ana.id, { salud: true, pesoDiario: true });
  check(conPeso.some((x) => x.id === 'peso'), 'a diario, «Tu peso» sale en «Tu día»');
  check((await api.guardarFrecuenciaPeso(ana.id, 'semanal')).peso_frecuencia === 'semanal', 'el coach lo pasa a una vez a la semana');
  const sinPeso = await api.tuDia(ana.id, { salud: true, pesoDiario: false });
  check(!sinPeso.some((x) => x.id === 'peso'), 'y entonces no sale en «Tu día» (se lo pide el check-in)');
  check(await lanza(() => api.guardarFrecuenciaPeso(ana.id, 'mensual')), 'solo a diario o una vez a la semana');
  await api.guardarFrecuenciaPeso(ana.id, 'diario');
}

console.log('\nLa comunidad del equipo (v0.43, migración 027)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const sinMigracion = crearApi({ ...b, select: async (t, f) => { if (t === 'comunidad_ajustes') throw new Error('relation "public.comunidad_ajustes" does not exist'); return b.select(t, f); } });
  check(JSON.stringify(await sinMigracion.comunidad()) === '{"disponible":false,"activa":false}', 'sin la migración 027, la comunidad no existe (la pestaña no sale) y no falla');
  check(JSON.stringify(await api.comunidad()) === '{"disponible":true,"activa":false}', 'con ella, cerrada de entrada');
  check((await api.abrirComunidad(true)).activa === true, 'el coach la abre');
  const aviso = await api.publicarEnComunidad({ texto: '¡Bienvenidos al muro!', fijada: true });
  check(aviso.tipo === 'aviso' && aviso.fijada, 'el coach publica un aviso fijado');
  const lunesM = lunesDe(hoyISO());
  await api.guardarReto({ titulo: 'Cuatro semanas constantes', desde: sumarDias(lunesM, -7), hasta: sumarDias(lunesM, 20), objetivo: 8 });
  check(await lanza(() => api.guardarReto({ titulo: 'Mal', desde: lunesM, hasta: sumarDias(lunesM, -1), objetivo: 3 })), 'un reto con las fechas en orden');
  // Otro atleta, Luis
  const luis = await api.crearAtleta({ nombre: 'Luis Martín', email: 'luis@test' });
  const codL = await api.crearInvitacion(luis.id);
  await b.auth.registrar('luis@test', 'contraseña-luis-1', 'Luis');
  await api.canjearCodigo(codL);
  await api.darConsentimientos();
  check((await api.muro()).posts.length === 0 && Object.keys(await api.personasComunidad()).length === 0 && (await api.retosComunidad()).length === 0, 'sin entrar, Luis no ve nada (ni nombres)');
  await api.entrarComunidad('Luis M.');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.miembroComunidad()) === null, 'Ana aún no ha entrado');
  check(await lanza(() => api.entrarComunidad('A')), 'el nombre, de 2 a 40 letras');
  const mA = await api.entrarComunidad('  Ana   L. ');
  check(mA.nombre === 'Ana L.' && mA.version === VERSION_COMUNIDAD && mA.normas_version === 'normas-2026-11' && !api.faltanNormas(mA), 'Ana entra con su nombre, el texto que aceptó y las normas leídas (v0.44)');
  check(api.faltanNormas({ ...mA, normas_version: null }) && !api.faltanNormas((({ normas_version, ...r }) => r)(mA)), 'sin las normas vigentes le faltan por leer; sin la migración 028 (sin columna), no');
  {
    const llamadas = [];
    const sin028 = crearApi({ ...b, rpc: async (nombre, args) => {
      if (nombre === 'comunidad_unirme') {
        llamadas.push(Object.keys(args).sort().join());
        if ('p_normas' in args) throw new Error('function public.comunidad_unirme(p_nombre => unknown, p_normas => unknown, p_version => unknown) does not exist');
        return null;
      }
      return b.rpc(nombre, args);
    } });
    await sin028.entrarComunidad('Ana L.');
    check(llamadas.join(' | ') === 'p_nombre,p_normas,p_version | p_nombre,p_version', 'sin la migración 028, se entra como en la v0.43 (la función aún no recibe las normas)');
  }
  let muro = await api.muro();
  check(muro.posts[0].id === aviso.id && muro.posts[0].autor.coach && muro.posts[0].autor.nombre === 'Pelayo Fernández', 've arriba el aviso del coach, con su nombre');
  const foto = new Blob(['jpeg de prueba'], { type: 'image/jpeg' });
  const pA = await api.publicarEnComunidad({ texto: 'Primera semana completa', foto });
  check(pA.tipo === 'post' && pA.foto_ruta.startsWith(`${ana.id}/`) && b.storage.ficheros.has(`comunidad:${pA.foto_ruta}`), 'publica con una foto (en su carpeta del bucket «comunidad»)');
  check(await lanza(() => api.publicarEnComunidad({ texto: '' })), 'algo que decir o una foto');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  muro = await api.muro();
  const pVisto = muro.posts.find((x) => x.id === pA.id);
  check(pVisto?.autor.nombre === 'Ana L.' && !pVisto.mio && /^pglite:\/\/comunidad\/.*\?s=300$/.test(await api.urlFotoComunidad(pA.foto_ruta)), 'Luis ve lo de Ana, con su nombre y su foto (enlace de 5 minutos)');
  check(!('atleta_id' in pVisto) && !('sesion_id' in pVisto), 'del muro, la app no pide la ficha ni la sesión de nadie');
  check(muro.posts[0].id === aviso.id && muro.posts[1].id === pA.id, 'el aviso fijado arriba y luego lo más nuevo');
  check((await api.reaccionar(pA.id, 'fuerza')) === 'fuerza' && (await api.reaccionar(pA.id, 'fuego')) === 'fuego', 'reacciona y cambia de reacción');
  await api.comentarEnComunidad(pA.id, '¡Muy bien!');
  check(await lanza(() => api.comentarEnComunidad(pA.id, 'x'.repeat(1001))), 'comentarios de hasta 1000 letras');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  muro = await api.muro();
  const pMio = muro.posts.find((x) => x.id === pA.id);
  check(pMio.mio && pMio.reacciones.fuego?.join() === 'Luis M.' && pMio.comentarios === 1 && !pMio.miReaccion, 'Ana ve quién ha reaccionado (y cómo) y cuántos comentarios tiene');
  const coms = await api.comentariosComunidad(pA.id);
  check(coms.length === 1 && coms[0].autor.nombre === 'Luis M.' && !coms[0].mio, 'y el comentario de Luis');
  // Compartir una sesión terminada
  const prog = await api.programa(ana.id);
  const hecha = Object.values(prog.sesiones).flat().find((x) => x.completada);
  const previa = await api.recordsParaEquipo(ana.id, hecha.id);
  const idE = await api.compartirEnEquipo(hecha.id, { texto: 'Hoy, pierna', kilos: false });
  muro = await api.muro();
  const e = muro.posts.find((x) => x.id === idE);
  check(e?.tipo === 'entreno' && e.resumen.nombre === hecha.nombre && e.resumen.con_kilos === false && e.texto === 'Hoy, pierna' && !JSON.stringify(e.resumen).includes('"kg"'),
    'comparte con el equipo una sesión terminada, sin los kilos (la tarjeta la hace la base)');
  check(await api.sesionCompartida(hecha.id) && await lanza(() => api.compartirEnEquipo(hecha.id)), 'y una sesión solo se comparte una vez');
  const nombresRecord = e.resumen.ejercicios.filter((x) => x.record).map((x) => x.nombre).sort().join();
  const ejNombres = Object.fromEntries((await api.historial(ana.id)).map((x) => [x.ejercicio_id, x.ejercicio]));
  check([...previa].map((id) => ejNombres[id]).sort().join() === nombresRecord, `la vista previa pone los mismos récords que la base (${nombresRecord || 'ninguno'})`);
  // Avisar al coach
  await api.avisarAlCoach({ comentarioId: coms[0].id, motivo: 'No me gusta' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  let band = await api.bandeja();
  check(band.comunidad.length === 1 && band.comunidad[0].quienAvisa === 'Ana L.' && band.comunidad[0].autor === 'Luis M.' && band.comunidad[0].comentario?.texto === '¡Muy bien!' && band.total >= 1,
    'el coach lo ve en Revisar: qué, de quién y quién avisa');
  await api.ocultarComentarioComunidad(band.comunidad[0].comentario.id, true);
  await api.resolverReporte(band.comunidad[0].id);
  band = await api.bandeja();
  check(band.comunidad.length === 0, 'lo oculta y lo da por resuelto');
  const retos = await api.retosComunidad();
  check(retos.length === 1 && retos[0].progreso.some((x) => x.nombre === 'Ana L.' && x.hechas >= 1) && retos[0].progreso.every((x) => Object.keys(x).sort().join() === 'foto,hechas,nombre,objetivo,perfil_id,reto_id,yo'),
    'el progreso del reto: solo nombre, foto y recuentos');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.comentariosComunidad(pA.id)).length === 0, 'Ana ya no ve el comentario oculto');
  const rk = await api.rankingComunidad();
  check(Array.isArray(rk) && rk.every((x) => Object.keys(x).sort().join() === 'foto,hechas,nombre,perfil_id,previstas,racha,yo'), `el ranking de la semana, solo recuentos (${rk.map((x) => `${x.nombre} ${x.hechas}/${x.previstas}`).join(', ') || 'sin semanas publicadas'})`);
  check((await api.ajustesComunidad({ sinRanking: true })).sin_ranking === true, 'Ana elige no salir en el ranking');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(!(await api.rankingComunidad()).some((x) => x.nombre === 'Ana L.') && !(await api.retosComunidad())[0].progreso.some((x) => x.nombre === 'Ana L.'), 'y Luis ya no la ve ni en el ranking ni en el reto');
  // Salir y volver
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.salirComunidad()).salido_en != null && (await api.muro()).posts.length === 0, 'Ana sale (y deja de ver el muro)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(!(await api.muro()).posts.some((x) => x.autor_id === ana.perfil_id || x.id === pA.id) && await lanza(() => api.urlFotoComunidad(pA.foto_ruta)), 'para Luis desaparece lo de Ana, también su foto');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.entrarComunidad('Ana L.');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.muro()).posts.some((x) => x.id === pA.id), 'al volver, lo suyo vuelve a verse');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.salirComunidad({ borrar: true });
  check((await b.sql(`select count(*)::int n from storage.objects where bucket_id = 'comunidad' and name = $1`, [pA.foto_ruta]))[0].n === 0, 'saliendo con «borrar», se borra lo suyo y su foto de Storage');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!(await api.muro()).posts.some((x) => x.autor_id === ana.perfil_id), 'también para el coach');
  const copia = await api.copiaCompleta();
  check(Array.isArray(copia.comunidad_posts) && copia.comunidad_miembros.length === 2 && copia.comunidad_retos.length === 1, 'la copia completa lleva la comunidad');
  // Revisión de la 027: avisos que sobreviven al borrado, «mis datos», sacar y readmitir
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  const pMal = await api.publicarEnComunidad({ texto: 'Algo que no debería' });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.entrarComunidad('Ana L.');
  await api.avisarAlCoach({ postId: pMal.id, motivo: 'Feo' });
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  await api.borrarDeComunidad(pMal);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const avisoBorrado = (await api.bandeja()).comunidad.find((r) => r.borrado);
  check(avisoBorrado?.texto === 'Algo que no debería' && avisoBorrado.autor === 'Luis M.' && avisoBorrado.quienAvisa === 'Ana L.', 'si el autor borra lo avisado, el coach lo sigue viendo en Revisar («borrado por su autor»)');
  await api.resolverReporte(avisoBorrado);
  check(!(await api.bandeja()).comunidad.some((r) => r.id === avisoBorrado.id), 'y lo da por resuelto');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pOc = await api.publicarEnComunidad({ texto: 'Para ocultar' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.ocultarEnComunidad(pOc.id, true);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.salirComunidad();
  const exp = await api.exportar(ana.id);
  check(exp.comunidad?.miembro?.nombre === 'Ana L.' && exp.comunidad.publicaciones.some((x) => x.id === pOc.id && x.oculta), '«Descargar mis datos» lleva todo lo suyo de la comunidad, también lo oculto y tras salir');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.expulsarDeComunidad(luis.id, true);
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.miembroComunidad()).bloqueado === true && await lanza(() => api.entrarComunidad('Luis M.')), 'el coach saca a Luis: no puede volver a entrar');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.expulsarDeComunidad(luis.id, false);
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.entrarComunidad('Luis M.')).salido_en === null, 'readmitido, vuelve a entrar él');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.miembrosComunidad()).length === 2, 'el coach ve quién ha entrado');
  await api.abrirComunidad(false);
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.comunidad()).activa === false && (await api.muro()).posts.length === 0, 'cerrada, nadie ve el muro');
  check(await lanza(() => api.abrirComunidad(true)), 'y un atleta no la abre');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
}

console.log('\nLas mejoras de la comunidad (v0.47, migración 029)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.abrirComunidad(true);
  const [aAna] = await b.sql(`select id, perfil_id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id, perfil_id from atletas where email = 'luis@test'`);
  // Sin la 029 en la base, entrar con el texto nuevo dice qué falta
  {
    const sin029 = crearApi({ ...b, rpc: async (nombre, args) => {
      if (nombre === 'comunidad_unirme') throw new Error('El texto que aceptas no es el vigente: recarga la app y vuelve a intentarlo');
      if (nombre === 'comunidad_version') return 'comunidad-2026-11';
      return b.rpc(nombre, args);
    } });
    await b.auth.entrar('ana@test', 'contraseña-ana-1');
    let msg = '';
    try { await sin029.entrarComunidad('Ana L.'); } catch (e) { msg = e.message; }
    check(/migración 029/.test(msg), 'sin la migración 029, entrar con lo que se comparte ahora dice que falta');
  }
  const mA = await api.entrarComunidad('Ana L.');
  await api.ajustesComunidad({ sinRanking: false });
  await b.sql(`insert into preferencias_notificaciones (usuario_id, email) values ($1, true) on conflict (usuario_id) do update set email = true`, [aAna.perfil_id]);
  check(api.dentroDeComunidad(mA) && !api.dentroDeComunidad({ ...mA, version: 'comunidad-2026-11' }) && !api.dentroDeComunidad({ ...mA, salido_en: new Date().toISOString() }), 'Ana vuelve aceptando el texto nuevo (con el de antes, estaría fuera)');
  const vistoAntes = new Date(Date.now() - 1000).toISOString();

  // Encuestas del coach
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await lanza(() => api.publicarEnComunidad({ encuesta: { pregunta: '¿Qué día?', opciones: ['Sábado'] } }))
    && await lanza(() => api.publicarEnComunidad({ encuesta: { pregunta: '¿Qué día?', opciones: ['Sábado', 'sábado'] } }))
    && await lanza(() => api.publicarEnComunidad({ encuesta: { pregunta: '¿Qué día?', opciones: ['Sábado', 'Domingo'], cierre: '2020-01-01T10:00' } })),
    'una encuesta, con 2 a 4 opciones distintas y el cierre en el futuro');
  const enc = await api.publicarEnComunidad({ encuesta: { pregunta: '¿Sábado o domingo?', opciones: ['Sábado', 'Domingo', ''], cierre: new Date(Date.now() + 864e5).toISOString() }, fijada: true });
  check(enc.tipo === 'encuesta' && enc.texto === '¿Sábado o domingo?' && enc.encuesta.opciones.join() === 'Sábado,Domingo' && enc.fijada, 'el coach publica una encuesta (las opciones vacías no van) y la fija arriba');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  // (053) un atleta también publica encuestas, una al día (sin fijar)
  const encAna = await api.publicarEnComunidad({ encuesta: { pregunta: '¿Y yo?', opciones: ['Sí', 'No'] }, fijada: true });
  check(encAna.tipo === 'encuesta' && !encAna.fijada && await lanza(() => api.publicarEnComunidad({ encuesta: { pregunta: '¿Otra?', opciones: ['Sí', 'No'] } })), 'un atleta publica una encuesta (053), sin fijarla, y solo una al día');
  await api.borrarDeComunidad(encAna);
  check((await api.votarEncuesta(enc.id, 1)) === 1 && (await api.votarEncuesta(enc.id, 0)) === 0 && await lanza(() => api.votarEncuesta(enc.id, 5)), 'Ana vota, cambia su voto y no vota una opción que no existe');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  await api.votarEncuesta(enc.id, 0);
  let muro = await api.muro();
  let pe = muro.posts.find((x) => x.id === enc.id);
  check(pe?.resultados?.total === 2 && pe.resultados.conteos.join() === '2,0' && pe.resultados.porcentajes.join() === '100,0' && pe.resultados.miVoto === 0 && pe.resultados.quien[0].sort().join() === 'Ana L.,Luis M.',
    'en el muro, los resultados: cuántos, qué %, mi voto y quién ha votado');

  // Menciones
  const pM = await api.publicarEnComunidad({ texto: '¡Vamos, @Ana L.!', menciones: [aAna.perfil_id, aAna.perfil_id, aLuis.perfil_id, coachId] });
  check(pM.menciones.join() === [aAna.perfil_id, coachId].join(), 'publica con menciones (sin repetir y sin él mismo, lo deja la base)');
  await api.comentarEnComunidad(pM.id, 'Y tú también, @Pelayo', [coachId]);
  muro = await api.muro();
  check(muro.posts.find((x) => x.id === pM.id)?.mencionados.map((x) => x.nombre).join() === 'Ana L.,Pelayo Fernández', 'el muro trae el nombre de cada mencionado');
  check((await api.comentariosComunidad(pM.id))[0].mencionados[0]?.perfil_id === coachId, 'y los comentarios, también');
  const avisoMencion = await b.sql(`select titulo, cuerpo, url from notificaciones where usuario_id = $1 and clave like 'comunidad_mencion:%'`, [aAna.perfil_id]);
  check(avisoMencion.some((x) => x.titulo === 'Luis M. te ha mencionado' && x.url === '#equipo' && !x.cuerpo.includes('Vamos')), 'a quien mencionan le avisa la base (sin el texto)');

  // Filtros del muro (en la consulta) y novedades
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pMia = await api.publicarEnComunidad({ texto: 'Lo mío' });
  const tipos = async (filtro) => [...new Set((await api.muro({ filtro })).posts.map((x) => x.tipo))].sort().join();
  const avisos = await tipos('avisos');
  check(['encuesta', 'aviso,encuesta'].includes(avisos) && !(await api.muro({ filtro: 'avisos' })).posts.some((x) => x.id === pMia.id), `«Avisos»: avisos y encuestas del coach (${avisos})`);
  check((await api.muro({ filtro: 'mio' })).posts.every((x) => x.mio) && (await api.muro({ filtro: 'mio' })).posts.some((x) => x.id === pMia.id), '«Lo mío»: solo lo suyo');
  check((await api.muro({ filtro: 'entrenos' })).posts.every((x) => x.tipo === 'entreno') && (await api.muro({ filtro: 'logros' })).posts.every((x) => x.tipo === 'logro'), '«Entrenos» y «Logros»');
  check((await api.novedadesComunidad(vistoAntes)) >= 2 && (await api.novedadesComunidad(new Date(Date.now() + 60000).toISOString())) === 0, 'las novedades: lo publicado por los demás desde su última visita (no lo suyo)');

  // Retos de equipo, logros y su celebración
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await lanza(() => api.guardarReto({ titulo: 'Mucho', desde: sumarDias(hoy, -60), hasta: sumarDias(hoy, 7), objetivo: 200 })), 'individual, hasta 100 sesiones');
  const rEq = await api.guardarReto({ titulo: 'Entre todos', desde: sumarDias(hoy, -60), hasta: sumarDias(hoy, 7), objetivo: 1, modo: 'equipo' });
  const rInd = await api.guardarReto({ titulo: 'Una sesión', desde: sumarDias(hoy, -60), hasta: sumarDias(hoy, 7), objetivo: 1 });
  check(rEq.modo === 'equipo' && rInd.modo === 'individual' && !!(await api.guardarReto({ titulo: 'Equipo grande', desde: hoy, hasta: sumarDias(hoy, 7), objetivo: 200, modo: 'equipo' })), 'de equipo, hasta 5000');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  let retos = await api.retosComunidad();
  const vEq = retos.find((r) => r.id === rEq.id), vInd = retos.find((r) => r.id === rInd.id);
  check(vEq.modo === 'equipo' && vEq.total >= 1 && vEq.conseguido && vInd.conseguido && !vInd.compartido, `el reto de equipo trae el total de todos (${vEq.total}) y si lo ha conseguido`);
  let logros = await api.logrosComunidad();
  check(logros.some((r) => r.id === rInd.id) && logros.some((r) => r.id === rEq.id), 'los logros por celebrar: los conseguidos sin compartir');
  const idLogro = await api.compartirLogro(rInd.id, '¡Hecho!');
  check(await lanza(() => api.compartirLogro(rInd.id)), 'un logro se comparte una vez');
  retos = await api.retosComunidad();
  check(retos.find((r) => r.id === rInd.id).compartido && !(await api.logrosComunidad()).some((r) => r.id === rInd.id), 'compartido, ya no se celebra');
  const pl = (await api.muro({ filtro: 'logros' })).posts.find((x) => x.id === idLogro);
  check(pl?.tipo === 'logro' && pl.resumen.titulo === 'Una sesión' && pl.texto === '¡Hecho!', 'y sale en el muro, en «Logros»');

  // Resumen, rachas, perfil y ánimos
  const res = await api.resumenSemanaComunidad();
  check(res && Object.keys(res).sort().join() === 'miembros,records,retos,semana_completa,sesiones' && res.retos >= 2, `el resumen de la semana (${JSON.stringify(res)})`);
  const rachas = await api.rachasComunidad();
  check(Object.values(rachas).every((x) => x.racha >= 1), 'las rachas de cada uno (solo desde 1: sin racha no sale nadie)');
  const pf = await api.perfilComunidad(aLuis.perfil_id);
  check(pf?.nombre === 'Luis M.' && pf.posts.length >= 1 && pf.posts.length <= 5 && pf.animado === false && typeof pf.entrenos === 'number', 'el perfil de Luis, con sus últimas publicaciones');
  await api.animar(aLuis.perfil_id);
  check((await api.perfilComunidad(aLuis.perfil_id)).animado && (await api.animosComunidad()).mandados.has(aLuis.perfil_id) && await lanza(() => api.animar(aLuis.perfil_id)), 'le manda ánimo (una vez por semana)');
  check(await lanza(() => api.animar(aAna.perfil_id)), 'a ella misma no');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.animosComunidad()).recibidos.map((x) => x.nombre).join() === 'Ana L.', 'Luis ve quién le ha animado esta semana');
  check((await api.perfilComunidad(coachId))?.coach === true, 'el perfil del coach');

  // «Descargar mis datos» y la copia completa
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  let exp = await api.exportar(ana.id);
  check(exp.comunidad.votos.some((v) => v.post_id === enc.id) && exp.comunidad.animos_mandados.some((a) => a.para === aLuis.perfil_id), '«Descargar mis datos» lleva sus votos y sus ánimos');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  exp = await api.exportar(aLuis.id);
  check(exp.comunidad.votos.length === 1 && exp.comunidad.animos_recibidos.length === 1 && !('de' in exp.comunidad.animos_recibidos[0]), 'la del coach para Luis, también (de los ánimos recibidos, solo cuándo)');
  const copia = await api.copiaCompleta();
  check(Array.isArray(copia.comunidad_votos) && copia.comunidad_votos.length === 2 && copia.comunidad_animos.length === 1, 'la copia completa lleva los votos y los ánimos');
  await api.abrirComunidad(false);
}

console.log('\nLo que encontró la revisión de seguridad de la 029 (capa de datos)');
{
  const [aAna] = await b.sql(`select id, perfil_id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id, perfil_id from atletas where email = 'luis@test'`);
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.abrirComunidad(true);
  // M1: una sesión con fecha del futuro no se guarda (con un mensaje claro)
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const prog = await api.programa(ana.id);
  const una = Object.values(prog.sesiones).flat().find((x) => x.completada);
  let msg = '';
  try { await api.actualizar('sesiones', una.id, { fecha_realizada: '2099-01-01' }); } catch (e) { msg = e.message; }
  check(/no puede ser posterior a hoy/.test(msg), 'una sesión fechada en el futuro no se guarda, y lo dice');
  check(!!(await api.actualizar('sesiones', una.id, { fecha_realizada: sumarDias(hoy, -2) })), 'una fecha pasada, sí');
  // L6: el miembro trae desde cuándo está dentro (la última vez que entró)
  const m = await api.miembroComunidad();
  check(!!m.entrado_en, 'el miembro trae entrado_en (desde la última vez que entró)');
  // L6: votar, como mucho 30 veces al día
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const enc = await api.publicarEnComunidad({ encuesta: { pregunta: '¿Uno o dos?', opciones: ['Uno', 'Dos'] } });
  await b.sql(`delete from comunidad_cupos where tipo = 'voto'`);
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  let tope = 0;
  for (let i = 0; i < 32; i++) { try { await api.votarEncuesta(enc.id, i % 2); tope++; } catch (e) { msg = e.message; break; } }
  check(tope === 30 && /30 veces/.test(msg), `votar o cambiar el voto, 30 veces al día como mucho (${tope})`);
  // L6: el coach no anima con la comunidad cerrada
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.abrirComunidad(false);
  check(await lanza(() => api.animar(aLuis.perfil_id)), 'con la comunidad cerrada, el coach no anima');
  // L3: la descarga de un atleta que saca el coach, sin identificadores de otras personas
  const exp = await api.exportar(aAna.id);
  const txt = JSON.stringify(exp.comunidad);
  check(!txt.includes(aLuis.perfil_id) && !txt.includes(aLuis.id) && exp.comunidad.animos_mandados.every((x) => Object.keys(x).sort().join() === 'creado_en,semana')
    && exp.comunidad.publicaciones.every((x) => typeof x.menciones === 'number'), 'la descarga que saca el coach no lleva identificadores de otros atletas (ni a quién animó ni a quién mencionó)');
}


console.log('\nTareas, mensajes programados, tu bloque, tu mes y el negocio (v0.48, migración 030)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id, perfil_id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id, perfil_id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from tareas`); // (las de la recuperación de Ana, más arriba)
  // Sin la 030, lo dice
  {
    const sin030 = crearApi({ ...b, insert: async (t, filas) => { if (t === 'tareas') throw new Error('relation "public.tareas" does not exist'); return b.insert(t, filas); } });
    let msg = '';
    try { await sin030.ponerTarea(aAna.id, { tipo: 'texto', titulo: 'X', fecha: hoy }); } catch (e) { msg = e.message; }
    check(/migración 030/.test(msg), 'sin la migración 030, poner una tarea dice que falta');
  }
  // Tareas
  const tT = await api.ponerTarea(aAna.id, { tipo: 'texto', titulo: '  ¿Cómo va el hombro? ', fecha: hoy });
  const tF = await api.ponerTarea(aAna.id, { tipo: 'foto', titulo: 'Foto de frente', fecha: sumarDias(hoy, 2) });
  check(tT.titulo === '¿Cómo va el hombro?' && (await api.tareas(aAna.id)).length === 2, 'el coach pone tareas (limpias)');
  check(await lanza(() => api.ponerTarea(aAna.id, { tipo: 'video', titulo: 'Vídeo', fecha: hoy })), 'una de vídeo, con su ejercicio');
  await api.guardarPlantillaTarea({ tipo: 'texto', titulo: '¿Qué tal la semana?' });
  check((await api.plantillasTareas()).length === 1, 'y guarda plantillas');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const dia = await api.tuDia(aAna.id, { hoy });
  check(dia.some((x) => x.accion === 'tarea' && x.tareaId === tT.id && x.estado === 'toca') && !dia.some((x) => x.tareaId === tF.id), '«Tu día» trae la de hoy y no la de pasado mañana');
  check(await lanza(() => api.completarTarea(tF.id)), 'la de otro día no se puede hacer aún');
  check(await lanza(() => api.completarTarea(tT.id, { respuesta: 'x'.repeat(501) })), 'una respuesta larguísima, no');
  await api.completarTarea(tT.id, { respuesta: 'Mejor, un 3' });
  check((await api.tuDia(aAna.id, { hoy })).find((x) => x.tareaId === tT.id)?.estado === 'hecho', 'hecha, sale como hecha');
  check(await lanza(() => api.plantillasTareas().then((p) => { if (p.length) throw new Error('ve plantillas'); })) === false && await lanza(() => api.borrarTarea(tT.id).then(async () => { if (!(await api.tareas(aAna.id)).length) throw new Error('borró'); })) === false,
    'el atleta no ve las plantillas ni borra sus tareas');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const band = await api.bandeja(hoy);
  const enBandeja = band.items?.tareas || band.tareas;
  check(enBandeja?.length === 1 && enBandeja[0].respuesta === 'Mejor, un 3' && enBandeja[0].atleta.id === aAna.id, 'el coach la tiene en Revisar, con su respuesta');
  await api.marcarRevisado('tarea', tT.id);
  check(!((await api.bandeja(hoy)).items?.tareas || (await api.bandeja(hoy)).tareas).length, 'revisada, sale de Revisar');
  const exp = await api.exportar(aAna.id);
  check(exp.tareas.length === 2, 'sus tareas van en la descarga de sus datos');

  // Mensajes programados
  const manana = new Date(Date.now() + 864e5).toISOString();
  check(await lanza(() => api.enviarMensaje(aAna.id, { texto: 'Hola', autor: 'coach', enviarEn: new Date(Date.now() - 1000).toISOString() }))
    && await lanza(() => api.enviarMensaje(aAna.id, { texto: 'Hola', autor: 'coach', enviarEn: new Date(Date.now() + 100 * 864e5).toISOString() }))
    && await lanza(() => api.enviarMensaje(aAna.id, { texto: '', autor: 'coach', enviarEn: manana })), 'programar: ni en el pasado, ni a más de 90 días, ni vacío');
  const prog = await api.enviarMensaje(aAna.id, { texto: 'Mañana, descarga', autor: 'coach', enviarEn: manana });
  const conv = await api.conversacion(aAna.id);
  check(conv.find((c) => c.id === prog.id)?.programado === true, 'el coach lo ve en el chat como programado');
  const cs = (await api.conversaciones()).find((x) => x.atleta.id === aAna.id);
  check(cs.programados === 1 && cs.ultimo?.id !== prog.id, 'en la lista de conversaciones no es el último mensaje (se cuenta aparte)');
  const otraHora = new Date(Date.now() + 2 * 864e5).toISOString();
  const r = await api.reprogramarMensaje(prog.id, { texto: 'Pasado mañana, descarga', enviarEn: otraHora });
  check(r.texto === 'Pasado mañana, descarga' && Date.parse(r.enviar_en) === Date.parse(otraHora), 'cambia el texto y la hora antes de que salga');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(!(await api.conversacion(aAna.id)).some((c) => c.id === prog.id) && !(await api.noLeidos(aAna.id)).some((c) => c.id === prog.id), 'Ana no lo ve ni cuenta como sin leer');
  check(!(await api.exportar(aAna.id)).comentarios.some((c) => c.id === prog.id), 'ni sale en su descarga');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!(await api.exportar(aAna.id)).comentarios.some((c) => c.id === prog.id), 'tampoco en la que saca el coach para ella');
  await api.reprogramarMensaje(prog.id, { enviarEn: null });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.conversacion(aAna.id)).some((c) => c.id === prog.id && !c.programado), '«Enviar ya»: sale en ese momento');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await lanza(() => api.reprogramarMensaje(prog.id, { texto: 'Otra cosa' })), 'ya salido, no se cambia');

  // Avisos programados
  const av = await api.guardarAviso({ texto: 'El lunes, nuevo bloque', enviarEn: manana });
  check(av.enviar_en && (await api.avisosCoach()).find((a) => a.id === av.id)?.programado, 'un aviso programado; el coach lo ve como programado');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(!(await api.avisos(aAna.id, sumarDias(hoy, 1))).some((a) => a.id === av.id), 'Ana no lo ve antes de su hora (aunque su móvil vaya adelantado)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const av2 = await api.guardarAviso({ texto: 'El lunes, nuevo bloque' }, av.id);
  check(av2.enviar_en === null, 'quitarle la hora lo publica ya');
  await b.delete('avisos', { eq: { id: av.id } });

  // Tu bloque entero
  const [bAna] = await b.sql(`select b.id from bloques b where b.atleta_id = $1 and b.estado = 'activo' and not b.es_plantilla limit 1`, [aAna.id]);
  if (bAna) {
    const [w] = await b.sql(`select id from semanas where bloque_id = $1 order by numero desc limit 1`, [bAna.id]);
    await b.sql(`update semanas set programacion = 'en_programacion' where id = $1`, [w.id]);
    await b.auth.entrar('ana@test', 'contraseña-ana-1');
    const tb = await api.tuBloque(aAna.id);
    check(!!tb && tb.semanas.some((x) => x.estado === 'por_publicar' && !x.sesiones.length) && tb.semanas.length >= 2, 'tu bloque entero: las semanas por publicar salen, sin nada dentro');
    await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
    await b.sql(`update semanas set programacion = 'programada' where id = $1`, [w.id]);
  } else check(false, 'Ana tiene un bloque activo');

  // Tu mes
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const mesActual = hoy.slice(0, 7);
  const rm = await api.resumenMes(aAna.id, mesActual);
  check(rm.mes === mesActual && typeof rm.sesiones.hechas === 'number' && Array.isArray(rm.records), 'el resumen de un mes, con sus sesiones y récords');
  const sinSalud = await api.resumenMes(aAna.id, mesActual, { salud: false });
  check(sinSalud.habitos === null && sinSalud.nutricion === null, 'sin consentimiento de salud, sin hábitos ni nutrición');
  check(Array.isArray(await api.resumenesMensuales(aAna.id, { n: 3 })), 'y los últimos meses (los que tienen algo)');

  // «Lo que te dijo tu coach»
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [se] = await b.sql(`select s.id sesion, se.ejercicio_id ej from sesiones s join sesion_ejercicios se on se.sesion_id = s.id join semanas w on w.id = s.semana_id join bloques bl on bl.id = w.bloque_id
    join ejercicios e on e.id = se.ejercicio_id where bl.atleta_id = $1 and e.nombre = 'Press banca' and w.programacion = 'programada' limit 1`, [aAna.id]);
  await api.comentar({ atletaId: aAna.id, sesionId: se.sesion, texto: 'En el press banca, junta escápulas', autor: 'coach' });
  await api.enviarMensaje(aAna.id, { texto: 'Press banca: lo hablamos el lunes', autor: 'coach', enviarEn: manana });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const dicho = await api.dichoPorCoach(aAna.id, [se.ej, sentadilla.id]);
  check(dicho[se.ej]?.lista.some((x) => /junta escápulas/.test(x.texto)) && !dicho[sentadilla.id] && !JSON.stringify(dicho).includes('el lunes'), '«Lo que te dijo tu coach»: lo que nombra el ejercicio (no lo de otro, ni lo programado)');
  check(Object.keys(await api.dichoPorCoach(aAna.id, [se.ej], se.sesion)).length === 0, 'sin repetir lo de la propia sesión');

  // Comparar check-ins y el panel de negocio (coach)
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const cks = await b.sql(`select id from checkins where atleta_id = $1 order by semana_inicio limit 2`, [aAna.id]);
  if (cks.length === 2) {
    const c = await api.compararCheckins(aAna.id, cks[1].id, cks[0].id);
    check(c.antes.checkin.id === cks[0].id && Array.isArray(c.filas), 'compara dos check-ins (en orden)');
  } else {
    await check(await lanza(() => api.compararCheckins(aAna.id, cks[0]?.id || 'x', 'y')), 'comparar con un check-in que no está, lo dice');
  }
  await b.sql(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  const pn = await api.panelNegocio(hoy);
  const esteMes = pn.meses.at(-1);
  check(pn.meses.length === 12 && esteMes.mes === mesActual && esteMes.bajas >= 1 && pn.activos >= 1, 'el panel de negocio: 12 meses, con la baja de Luis en este mes (la base apunta el día)');
  await b.sql(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const pnA = await api.panelNegocio(hoy).catch(() => null);
  check(!pnA || (pnA.activos === 0 && pnA.cobrado12 === 0), 'un atleta no saca nada del negocio');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await b.sql(`delete from tareas`); await b.sql(`delete from tareas_plantillas`);
}

console.log('\nEl chat como WhatsApp (v0.54, migración 032)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id, perfil_id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id, perfil_id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from chat_cupos`);
  const hola = await api.enviarMensaje(aAna.id, { texto: '¿Qué tal *la rodilla*?', autor: 'coach' });
  const paraLuis = await api.enviarMensaje(aLuis.id, { texto: 'Luis, descansa', autor: 'coach' });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const resp = await api.enviarMensaje(aAna.id, { texto: 'Mejor', autor: 'atleta', respondeA: hola.id });
  check(resp.responde_a === hola.id, 'responder citando: el mensaje lleva su cita');
  check(await lanza(() => api.enviarMensaje(aAna.id, { texto: 'x', autor: 'atleta', respondeA: paraLuis.id })), 'citar uno de otra conversación, no (lo dice la base)');
  check(await api.reaccionarMensaje(hola.id, '💪') === '💪' && await api.reaccionarMensaje(hola.id, '❤️') === '❤️', 'reaccionar y cambiar la reacción');
  let conv = await api.conversacion(aAna.id);
  check(conv.find((c) => c.id === hola.id).reacciones.length === 1 && conv.find((c) => c.id === hola.id).reacciones[0].emoji === '❤️', 'la conversación trae las reacciones (una por persona)');
  check(await api.reaccionarMensaje(hola.id, '❤️') === null && !(await api.conversacion(aAna.id)).find((c) => c.id === hola.id).reacciones.length, 'tocar la misma la quita');
  // (v0.56, 034) cualquier emoji, pero un emoji
  check(await lanza(() => api.reaccionarMensaje(hola.id, 'ok')) && await lanza(() => api.reaccionarMensaje(hola.id, '👍 ')), 'solo emojis (ni texto ni espacios)');
  await api.destacar(hola.id, true);
  await api.destacar(hola.id, true);
  check((await api.conversacion(aAna.id)).find((c) => c.id === hola.id).destacado === true && (await api.destacados(aAna.id)).map((x) => x.id).join() === hola.id, 'destacar (dos veces no falla) y la lista de destacados');
  const ed = await api.editarMensaje(resp.id, 'Mucho mejor');
  check(ed.texto === 'Mucho mejor' && !!ed.editado_en, 'editar lo propio: «Editado»');
  check(await lanza(() => api.editarMensaje(hola.id, 'No')) && await lanza(() => api.editarMensaje(resp.id, '   ')), 'no lo del coach, ni en blanco');
  check((await api.eliminarMensaje(resp)).estado === 'eliminado', 'eliminar para todos');
  conv = await api.conversacion(aAna.id);
  const elim = conv.find((c) => c.id === resp.id);
  check(elim.eliminado_en && elim.texto === 'Se eliminó este mensaje' && elim.responde_a === null && !elim.reacciones.length, 'queda «Se eliminó este mensaje», sin cita ni reacciones');
  // Una foto del chat eliminada: se va de Storage
  const foto = await api.enviarMensaje(aAna.id, { texto: '', archivo: new Blob(['jpg'], { type: 'image/jpeg' }), autor: 'atleta' });
  const [arch] = await b.sql(`select ruta from archivos where id = $1`, [foto.archivo_id]);
  check((await b.sql(`select 1 from storage.objects where name = $1`, [arch.ruta])).length === 1, 'la foto, subida');
  const rFoto = await api.eliminarMensaje({ id: foto.id });
  check(rFoto.estado === 'eliminado' && !(await b.sql(`select 1 from archivos where ruta = $1`, [arch.ruta])).length, 'al eliminarla para todos, la foto se va de la base');
  check((await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [arch.ruta])).length === 1, 'y su ruta queda en la cola de Storage');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.limpiarAlmacenamiento();
  check(!(await b.sql(`select 1 from storage.objects where name = $1`, [arch.ruta])).length && !(await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [arch.ruta])).length, 'el barrido del coach la quita de Storage y de la cola');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.conversacion(aAna.id)).find((c) => c.id === foto.id)?.eliminado_en, 'y su mensaje queda como eliminado');
  // Presencia
  const p1 = await api.marcarPresencia();
  check(p1?.visible === true && !!p1.ultima_conexion, 'marca su última conexión');
  check((await api.miPresencia()).visible === true, 'y la lee');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.marcarPresencia();
  check(!!(await api.ultimaConexion(aAna.perfil_id)), 'el coach ve la última conexión de Ana');
  check(!(await api.ultimaConexion(aLuis.perfil_id)), '(Luis aún no ha entrado: nada)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(!!(await api.ultimaConexion()), 'Ana ve la del coach');
  await api.marcarPresencia(false);
  check((await api.miPresencia()).visible === false && !(await api.ultimaConexion()), 'la oculta: deja de ver la del coach');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!(await api.ultimaConexion(aAna.perfil_id)), 'y el coach la de Ana');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.marcarPresencia(true);
  // Lista del coach: estado, búsqueda, no leído
  await api.enviarMensaje(aAna.id, { texto: 'Pelayo, una pregunta sobre la sentadilla', autor: 'atleta' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.cambiarEstadoConversacion(aLuis.id, { fijada: true });
  await api.cambiarEstadoConversacion(aAna.id, { archivada: true });
  let lista = await api.conversaciones();
  check(!!lista.find((x) => x.atleta.id === aLuis.id).estado?.fijada_en && !!lista.find((x) => x.atleta.id === aAna.id).estado?.archivada_en, 'fijar y archivar (la lista trae el estado de cada una)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.enviarMensaje(aAna.id, { texto: 'Otra cosa', autor: 'atleta' });
  check(Object.keys(await api.estadoConversaciones()).length === 0, 'Ana no ve el estado de las conversaciones');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  lista = await api.conversaciones();
  check(!lista.find((x) => x.atleta.id === aAna.id).estado?.archivada_en, 'su mensaje nuevo la saca de archivadas');
  await api.cambiarEstadoConversacion(aLuis.id, { noLeida: true });
  check((await api.conversaciones()).find((x) => x.atleta.id === aLuis.id).estado.no_leida === true, '«Marcar como no leído»');
  const enc = await api.buscarMensajes('SENTADILLA');
  check(enc.length >= 1 && enc.every((m) => m.atleta_id === aAna.id) && (await api.buscarMensajes('x')).length === 0, 'buscar en los mensajes (sin mayúsculas; 2 letras como mínimo)');
  check(lista.find((x) => x.atleta.id === aAna.id).sinLeer >= 1 && (await api.mensajesSinLeer()) >= 1, 'lo sin leer se cuenta (lo eliminado, no)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.buscarMensajes('sentadilla')).length === 0, 'un atleta no busca en los mensajes de nadie');
  // Programado: invisible por las vías nuevas
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const manana = new Date(Date.now() + 864e5).toISOString();
  const prog = await api.enviarMensaje(aAna.id, { texto: 'Sorpresa', autor: 'coach', enviarEn: manana });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(await lanza(() => api.reaccionarMensaje(prog.id, '👍')) && await lanza(() => api.destacar(prog.id, true)) && await lanza(() => api.enviarMensaje(aAna.id, { texto: 'x', autor: 'atleta', respondeA: prog.id })),
    'al programado no se reacciona, ni se destaca, ni se cita antes de que salga');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.eliminarMensaje(prog)).estado === 'cancelado', 'el coach cancela un programado (eliminar = cancelar el envío)');
  await b.sql(`delete from conversacion_estado`); await b.sql(`delete from chat_cupos`);
}

console.log('\nEl chat, aún más como WhatsApp (v0.55, migración 033)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id, perfil_id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id, perfil_id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from chat_cupos`);
  check(await api.chat033() === true, 'la app sabe que la base tiene la 033');
  // Sin la 033, lo de antes funciona y lo nuevo dice qué falta
  {
    const falta = (t) => new Error(`relation "public.${t}" does not exist`);
    const sin033 = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: b.rpc.bind(b), update: b.update.bind(b), delete: b.delete.bind(b),
      select: async (t, f) => { if (['conversacion_fijado', 'chat_silencios', 'listas_difusion', 'listas_difusion_miembros'].includes(t)) throw falta(t); return b.select(t, f); },
      insert: async (t, filas) => { if (t === 'comentarios' && filas.some((x) => 'cliente_id' in x)) throw new Error("Could not find the 'cliente_id' column of 'comentarios' in the schema cache"); return b.insert(t, filas); },
      upsert: async (t) => { throw falta(t); } });
    const m = await sin033.enviarMensaje(aAna.id, { texto: 'Sin la 033 también sale', autor: 'coach', clienteId: crypto.randomUUID() });
    check(!!m?.id && !m.cliente_id, 'sin la 033, un mensaje con el id del móvil sale igual (sin él)');
    let msg = '';
    try { await sin033.fijarMensaje(aAna.id, m.id, '7d'); } catch (e) { msg = e.message; }
    check(/migración 033/.test(msg) && await sin033.fijado(aAna.id) === null && Object.keys(await sin033.silencios()).length === 0, 'fijar dice que falta la 033 (y leer lo fijado o silenciado, nada)');
    msg = '';
    try { await sin033.listasDifusion(); } catch (e) { msg = e.message; }
    check(/migración 033/.test(msg), 'las listas de difusión, también');
    check((await sin033.conversacion(aAna.id)).some((c) => c.id === m.id), 'y la conversación se lee como siempre');
  }
  // Sin duplicados: el mismo id del móvil, una sola vez
  const cid = crypto.randomUUID();
  const e1 = await api.enviarMensaje(aAna.id, { texto: 'Reintento sin cobertura', autor: 'coach', clienteId: cid });
  const e2 = await api.enviarMensaje(aAna.id, { texto: 'Reintento sin cobertura', autor: 'coach', clienteId: cid });
  check(e1.id === e2.id && (await b.sql(`select count(*)::int n from comentarios where cliente_id = $1`, [cid]))[0].n === 1, 'reenviar el mismo mensaje (sin respuesta la primera vez) no lo duplica: devuelve el que ya está');
  // Entregado
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.noLeidos(aAna.id);
  await api.marcarEntregados({ ya: true });
  check(!!(await b.sql(`select entregado_en from comentarios where id = $1`, [e1.id]))[0].entregado_en, 'la app de Ana descarga lo del coach: entregado (✓✓ gris para él)');
  // PDF
  const pdf = new Blob(['%PDF-1.7\n<< /Type /Pages /Count 2 >>'], { type: 'application/pdf' });
  pdf.name = '../Mi plan\u0007 de comidas.pdf';
  const mPdf = await api.enviarMensaje(aAna.id, { texto: '', archivo: pdf, autor: 'atleta', paginas: 2 });
  const [aPdf] = await b.sql(`select * from archivos where id = $1`, [mPdf.archivo_id]);
  check(aPdf.tipo === 'documento' && aPdf.nombre === 'Mi plan de comidas.pdf' && aPdf.paginas === 2 && new RegExp(`^${aAna.id}/documento-\\d{4}-\\d{2}-\\d{2}-[a-z0-9]+\\.pdf$`).test(aPdf.ruta) && mPdf.texto === 'Documento',
    'Ana manda un PDF: documento del chat, con su nombre saneado aparte y la ruta generada (nunca sale del nombre)');
  check((await api.conversacion(aAna.id)).find((c) => c.id === mPdf.id)?.medio === 'documento' && !(await api.diario(aAna.id)).some((a) => a.id === aPdf.id), 'en el chat, un documento; en su diario, no');
  check(!!(await api.urlArchivo(aPdf.ruta)), 'y lo abre con su enlace firmado');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(await lanza(() => api.urlArchivo(aPdf.ruta)), 'Luis no');
  // Fijar
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.fijarMensaje(aAna.id, e1.id, '24h');
  check((await api.fijado(aAna.id))?.mensaje?.id === e1.id, 'el coach fija un mensaje');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.fijado(aAna.id))?.comentario_id === e1.id && await lanza(() => api.fijarMensaje(aAna.id, mPdf.id, '7d')) && await lanza(() => api.desfijarMensaje(aAna.id)).then(async (x) => x || !!(await api.fijado(aAna.id))),
    'Ana lo ve, pero ni fija ni desfija');
  // Silenciar
  await api.silenciar(aAna.id, '8h');
  const sil = await api.silencios();
  check(!!sil[aAna.id] && Date.parse(sil[aAna.id].hasta) > Date.now() + 7 * 3600000, 'Ana silencia su chat 8 horas');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!Object.keys(await api.silencios()).length, 'el coach no lo ve');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.silenciar(aAna.id, null);
  check(!Object.keys(await api.silencios()).length, 'y lo vuelve a activar');
  // Listas de difusión y difundir
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const lista = await api.guardarListaDifusion({ nombre: ' Compiten ', miembros: [aAna.id, aLuis.id] });
  check(lista.nombre === 'Compiten' && igual((await api.listasDifusion()).find((l) => l.id === lista.id).miembros.sort(), [aAna.id, aLuis.id].sort()), 'el coach crea una lista con Ana y Luis');
  check(await lanza(() => api.guardarListaDifusion({ nombre: 'compiten' })), 'sin repetir el nombre');
  const d1 = await api.difundir({ listaId: lista.id, texto: 'Mañana, test de 1RM' });
  check(d1.enviados === 2 && d1.saltados === 0, 'difunde un mensaje: a cada uno en su chat');
  await b.sql(`update atletas set estado = 'baja' where id = $1`, [aLuis.id]);
  const d2 = await api.difundir({ listaId: lista.id, texto: 'Solo a los activos' });
  check(d2.enviados === 1 && d2.saltados === 1, 'Luis, de baja, se salta (y se dice)');
  await b.sql(`update atletas set estado = 'activo' where id = $1`, [aLuis.id]);
  const foto = new Blob(['jpg'], { type: 'image/jpeg' });
  foto.name = 'gym.jpg';
  const d3 = await api.difundir({ listaId: lista.id, texto: 'El gimnasio nuevo', archivo: foto });
  const copias = await b.sql(`select a.atleta_id, a.ruta from comentarios c join archivos a on a.id = c.archivo_id where c.texto = 'El gimnasio nuevo'`);
  check(d3.enviados === 2 && copias.length === 2 && copias.every((x) => x.ruta.startsWith(`${x.atleta_id}/`)) && new Set(copias.map((x) => x.ruta)).size === 2, 'con foto: se sube una vez y cada uno recibe su copia, en su carpeta');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  const deLuis = copias.find((x) => x.atleta_id === aLuis.id), deAna = copias.find((x) => x.atleta_id === aAna.id);
  check(!!(await api.urlArchivo(deLuis.ruta)) && await lanza(() => api.urlArchivo(deAna.ruta)), 'Luis ve su copia; la de Ana, no');
  check(await lanza(() => api.listasDifusion()).then(async (x) => x || !(await api.listasDifusion()).length) && await lanza(() => api.difundir({ listaId: lista.id, texto: 'x' })), 'Luis no ve las listas ni difunde');
  // Reenviar
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const guia = await api.enviarMensaje(aAna.id, { texto: 'Guía de calentamiento', autor: 'coach' });
  const rr = await api.reenviar(guia, [aLuis.id]);
  check(rr.enviados === 1, 'el coach reenvía un mensaje suyo a Luis');
  const foto2 = new Blob(['jpg2'], { type: 'image/jpeg' });
  foto2.name = 'tecnica.jpg';
  const conFoto = await api.enviarMensaje(aAna.id, { texto: 'Así, la espalda', archivo: foto2, autor: 'coach' });
  const rf = await api.reenviar((await api.conversacion(aAna.id)).find((c) => c.id === conFoto.id), [aLuis.id]);
  check(rf.enviados === 1 && rf.fallidos === 0, 'y uno con foto (con su copia)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  const convL = await api.conversacion(aLuis.id);
  const fw = convL.find((c) => c.texto === 'Así, la espalda');
  check(convL.some((c) => c.texto === 'Guía de calentamiento' && c.reenviado) && fw?.reenviado && fw.archivo && fw.archivo.ruta.startsWith(`${aLuis.id}/`) && !!(await api.urlArchivo(fw.archivo.ruta)), 'a Luis le llegan con «Reenviado» (la foto, su copia)');
  check(await lanza(() => api.reenviar(fw, [aAna.id])), 'Luis no reenvía');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const deAnaTxt = await api.enviarMensaje(aAna.id, { texto: 'Me duele la rodilla', autor: 'atleta' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await lanza(() => api.reenviar(deAnaTxt, [aLuis.id])), 'el coach no reenvía lo de un atleta (son datos de salud de otra persona)');
  // (revisión) Reenviar y difundir cuando la base lo crea pero la respuesta se pierde (sin cobertura): las copias no se
  // retiran (vaciarían los mensajes ya entregados) y el reintento, con los mismos ids, no duplica
  {
    let perder = null, rechazar = null;
    const conFallos = crearApi({ ...b, auth: b.auth, storage: b.storage, select: b.select.bind(b), insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b),
      rpc: async (n, a) => {
        if (rechazar === n) { rechazar = null; throw new Error('Falta la copia del archivo para uno de los atletas'); }
        const r = await b.rpc(n, a);
        if (perder === n) { perder = null; const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; }
        return r;
      } });
    const enLuis = async (texto) => b.sql(`select c.id, c.archivo_id, c.eliminado_en, a.ruta from comentarios c left join archivos a on a.id = c.archivo_id where c.atleta_id = $1 and c.texto = $2`, [aLuis.id, texto]);
    const foto3 = new Blob(['jpg3'], { type: 'image/jpeg' }); foto3.name = 'rodilla-bien.jpg';
    const original = await api.enviarMensaje(aAna.id, { texto: 'Postura de la plancha', archivo: foto3, autor: 'coach' });
    const orig = (await api.conversacion(aAna.id)).find((c) => c.id === original.id);
    const envio = {};
    perder = 'chat_reenviar';
    check(await lanza(() => conFallos.reenviar(orig, [aLuis.id], envio)), '(revisión) reenviar: la base lo crea, pero la respuesta se pierde');
    let l1 = await enLuis('Postura de la plancha');
    check(l1.length === 1 && l1[0].archivo_id && !l1[0].eliminado_en && (await b.sql(`select count(*)::int n from archivos where id = $1`, [l1[0].archivo_id]))[0].n === 1,
      '(revisión) sin cobertura no se retira la copia: el mensaje que ya le llegó a Luis sigue con su foto (no «Se eliminó»)');
    const rRe = await conFallos.reenviar(orig, [aLuis.id], envio);
    l1 = await enLuis('Postura de la plancha');
    check(rRe.enviados === 1 && l1.length === 1 && !l1[0].eliminado_en, '(revisión) el reintento, con los mismos ids, no lo duplica (y dice que ya está)');
    check((await b.sql(`select count(*)::int n from archivos where atleta_id = $1 and tipo = 'adjunto' and not exists (select 1 from comentarios c where c.archivo_id = archivos.id)`, [aLuis.id]))[0].n === 0, '(revisión) y no deja copias sueltas');
    // Si la base lo rechaza (no es la cobertura), las copias sin mensaje se retiran
    const antesSueltas = (await b.sql(`select count(*)::int n from archivos where atleta_id = $1`, [aLuis.id]))[0].n;
    rechazar = 'chat_reenviar';
    check(await lanza(() => conFallos.reenviar(orig, [aLuis.id], {})), '(revisión) un rechazo de la base…');
    check((await b.sql(`select count(*)::int n from archivos where atleta_id = $1`, [aLuis.id]))[0].n === antesSueltas, '(revisión) …retira la copia que no lleva mensaje');
    // Difundir: igual
    const lista2 = await api.guardarListaDifusion({ nombre: 'Reintentos', miembros: [aAna.id, aLuis.id] });
    const foto4 = new Blob(['jpg4'], { type: 'image/jpeg' }); foto4.name = 'pista.jpg';
    const envioD = {};
    perder = 'chat_difundir';
    check(await lanza(() => conFallos.difundir({ listaId: lista2.id, texto: 'Pista nueva', archivo: foto4, envio: envioD })), '(revisión) difundir: se pierde la respuesta');
    const dRe = await conFallos.difundir({ listaId: lista2.id, texto: 'Pista nueva', archivo: foto4, envio: envioD });
    const msgsD = await b.sql(`select c.atleta_id, c.eliminado_en, c.archivo_id from comentarios c where c.texto = 'Pista nueva'`);
    check(dRe.enviados === 2 && msgsD.length === 2 && msgsD.every((x) => !x.eliminado_en && x.archivo_id), '(revisión) el reintento no la repite y los mensajes siguen con su foto');
    check((await b.sql(`select count(*)::int n from archivos a where a.ruta like '%' and a.tipo = 'adjunto' and a.creado_en > now() - interval '1 hour' and not exists (select 1 from comentarios c where c.archivo_id = a.id)`))[0].n === 0, '(revisión) sin copias sueltas');
    // Una difusión rechazada (no por la cobertura): lo subido, fuera
    const foto5 = new Blob(['jpg5'], { type: 'image/jpeg' }); foto5.name = 'x.jpg';
    rechazar = 'chat_difundir';
    check(await lanza(() => conFallos.difundir({ listaId: lista2.id, texto: 'Rechazada', archivo: foto5, envio: {} })), '(revisión) difundir rechazada…');
    check((await b.sql(`select count(*)::int n from archivos a where a.tipo = 'adjunto' and a.creado_en > now() - interval '1 hour' and not exists (select 1 from comentarios c where c.archivo_id = a.id)`))[0].n === 0, '(revisión) …retira lo subido');
  }
  // (revisión) Un valor rechazado por la base no es «falta la 033»
  {
    const rechazo = new Error('new row for relation "listas_difusion" violates check constraint "listas_difusion_nombre_valido"'); rechazo.code = '23514';
    const conCheck = crearApi({ ...b, auth: b.auth, storage: b.storage, select: b.select.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), rpc: b.rpc.bind(b),
      insert: async (t, f) => { if (t === 'listas_difusion') throw rechazo; return b.insert(t, f); } });
    let m1 = '';
    try { await conCheck.guardarListaDifusion({ nombre: 'Válido para la app' }); } catch (e) { m1 = e.message; }
    check(m1 && !/migración 033/.test(m1), `(revisión) un nombre que la base rechaza no dice «falta la migración 033» (${m1.slice(0, 60)})`);
    check(await lanza(() => api.guardarListaDifusion({ nombre: '\u200b\u200b' })) && !(await api.listasDifusion()).some((l) => /\u200b/.test(l.nombre)), '(revisión) un nombre solo con invisibles no vale');
    let m2 = '';
    const sinTabla = crearApi({ ...b, auth: b.auth, storage: b.storage, select: b.select.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), rpc: b.rpc.bind(b),
      insert: async (t, f) => { if (t === 'listas_difusion') { const e = new Error('relation "public.listas_difusion" does not exist'); e.code = '42P01'; throw e; } return b.insert(t, f); } });
    try { await sinTabla.guardarListaDifusion({ nombre: 'Otra' }); } catch (e) { m2 = e.message; }
    check(/migración 033/.test(m2), '(y sin la tabla, sí lo dice)');
  }
  check(typeof (await (async () => { await b.auth.entrar('ana@test', 'contraseña-ana-1'); return api.nombreCoach(); })()) === 'string', 'el atleta tiene el nombre de su coach para «Info del contacto»');
  await b.sql(`delete from listas_difusion`); await b.sql(`delete from chat_cupos`); await b.sql(`delete from conversacion_fijado`);
}

console.log('\nv0.56: notas de voz, encuestas, «escuchado» y reacciones a elegir (migración 034)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from chat_cupos`); await b.sql(`delete from presencia`);
  check(await api.chat034() === true, 'la app sabe que la base tiene la 034');
  // Sin la 034: lo de antes, como siempre; lo nuevo dice qué falta
  {
    const falta = (t) => { const e = new Error(`relation "public.${t}" does not exist`); e.code = '42P01'; return e; };
    const sin034 = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: b.rpc.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), insert: b.insert.bind(b),
      select: async (t, f) => { if (['encuestas_chat', 'encuesta_votos'].includes(t)) throw falta(t); return b.select(t, f); } });
    let m = '';
    try { await sin034.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(400)], 'n.webm', { type: 'audio/webm' }), autor: 'coach', duracion_seg: 3 }); } catch (e) { m = e.message; }
    check(/migración 034/.test(m), 'sin la 034, una nota de voz dice que falta la migración (y no sube nada)');
    m = '';
    try { await sin034.crearEncuestaChat({ atletaId: aAna.id, pregunta: '¿Sí?', opciones: ['Sí', 'No'] }); } catch (e) { m = e.message; }
    check(/migración 034/.test(m), 'las encuestas, también');
    const hola0 = await sin034.enviarMensaje(aAna.id, { texto: 'Antes de la 034', autor: 'coach' });
    m = '';
    try { await sin034.reaccionarMensaje(hola0.id, '🔥'); } catch (e) { m = e.message; }
    check(/migración 034/.test(m) && await sin034.reaccionarMensaje(hola0.id, '👍') === '👍', 'una reacción nueva, también (las seis de siempre, sí)');
    check((await sin034.conversacion(aAna.id)).some((c) => c.id === hola0.id && c.encuesta === null), 'y la conversación se lee como siempre');
  }
  // Nota de voz: se sube con su tipo (sin parámetros), su ruta audio-…, su duración y su onda; el mensaje, «Nota de voz»
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const onda = Array.from({ length: 40 }, (_, i) => (i * 13) % 101);
  const progreso = [];
  const voz = new File([new Uint8Array(24000)], 'nota-de-voz.webm', { type: 'audio/webm;codecs=opus' });
  const mV = await api.enviarMensaje(aAna.id, { archivo: voz, autor: 'atleta', duracion_seg: 41.6, onda, texto: 'esto no va', alProgreso: (x) => progreso.push(x) });
  const [aV] = await b.sql(`select * from archivos where id = $1`, [mV.archivo_id]);
  check(aV.tipo === 'audio' && aV.mime === 'audio/webm' && aV.duracion_seg === 42 && aV.onda.length === 40 && new RegExp(`^${aAna.id}/audio-\\d{4}-\\d{2}-\\d{2}-[a-z0-9]+\\.webm$`).test(aV.ruta) && mV.texto === 'Nota de voz' && aV.subido_por === 'atleta',
    'Ana manda una nota de voz: audio/webm (sin parámetros), ruta audio-…, 42 s, su onda y «Nota de voz» (sin pie)');
  const iphone = await api.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(500)], 'n.mp4', { type: 'audio/mp4' }), autor: 'atleta', duracion_seg: 2 });
  check((await b.sql(`select ruta, mime from archivos where id = $1`, [iphone.archivo_id]))[0].ruta.endsWith('.m4a'), 'la del iPhone (audio/mp4), .m4a');
  check(await lanza(() => api.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(3 * 1048576 + 1)], 'n.webm', { type: 'audio/webm' }), autor: 'atleta', duracion_seg: 10 }))
    && await lanza(() => api.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(10)], 'n.wav', { type: 'audio/wav' }), autor: 'atleta', duracion_seg: 10 })), 'más de 3 MB o un formato que no es de los de grabar, no');
  const convA = await api.conversacion(aAna.id);
  check(convA.find((c) => c.id === mV.id)?.medio === 'audio' && convA.find((c) => c.id === mV.id).archivo?.onda?.length === 40, 'en el chat, una nota de voz (con su onda para dibujarla)');
  // «Escuchado»
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!!(await api.marcarEscuchado(mV.id)) && !!(await b.sql(`select escuchado_en from comentarios where id = $1`, [mV.id]))[0].escuchado_en, 'el coach la escucha: escuchada (el micro azul para Ana)');
  check(await api.marcarEscuchado(iphone.id).then((x) => !!x) && (await api.marcarEscuchado('00000000-0000-4000-8000-000000000000')) === null, 'una que no es para él (o no existe), nada (sin error en la pantalla)');
  const deCoach = await api.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(800)], 'n.webm', { type: 'audio/webm' }), autor: 'coach', duracion_seg: 5, onda: Array(8).fill(50) });
  // Reenviarla (la suya)
  const rf = await api.reenviar((await api.conversacion(aAna.id)).find((c) => c.id === deCoach.id), [aLuis.id]);
  const [copia] = await b.sql(`select a.* from comentarios c join archivos a on a.id = c.archivo_id where c.atleta_id = $1 and c.reenviado and a.tipo = 'audio'`, [aLuis.id]);
  check(rf.enviados === 1 && copia && copia.ruta.startsWith(`${aLuis.id}/audio-`) && copia.duracion_seg === 5 && copia.onda.length === 8, 'el coach reenvía su nota de voz a Luis (su copia, con su duración y su onda)');
  // (revisión) Las notas de voz, en su bucket («voz»): la subida, la copia, el enlace firmado y el borrado
  check(cuboDe(aV.ruta) === 'voz' && cuboDe(`${aAna.id}/adjunto-2026-11-03-abc.jpg`) === 'archivos' && cuboDe('x/cualquiera.webm', 'audio') === 'voz' && cuboDe(null) === 'archivos',
    '(revisión) cada ruta, a su bucket: las notas de voz, a «voz»');
  const enVoz = (r) => b.sql(`select 1 from storage.objects where bucket_id = 'voz' and name = $1`, [r]).then((x) => x.length === 1);
  const enArch = (r) => b.sql(`select 1 from storage.objects where bucket_id = 'archivos' and name = $1`, [r]).then((x) => x.length === 1);
  check(await enVoz(aV.ruta) && !(await enArch(aV.ruta)) && await enVoz(copia.ruta) && !(await enArch(copia.ruta)), '(revisión) la nota de Ana y la copia para Luis están en «voz» (no en «archivos»)');
  check(/^pglite:\/\/voz\//.test(await api.urlArchivo(aV.ruta, { tipo: 'audio' })) && /^pglite:\/\/voz\//.test(await api.urlArchivo(aV.ruta)), '(revisión) y su enlace firmado sale de «voz»');
  const borrable = await api.enviarMensaje(aAna.id, { archivo: new File([new Uint8Array(600)], 'n.webm', { type: 'audio/webm' }), autor: 'coach', duracion_seg: 3 });
  const rutaBorrable = (await b.sql(`select ruta from archivos where id = $1`, [borrable.archivo_id]))[0].ruta;
  check(await enVoz(rutaBorrable), '(la del coach, también en «voz»)');
  await api.eliminarMensaje(borrable.id);
  await api.limpiarAlmacenamiento?.();
  check(!(await enVoz(rutaBorrable)) && !(await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = $1`, [rutaBorrable])).length, '(revisión) eliminada para todos (el coach), se borra de «voz» (y sale de la cola)');
  const deAnaV = (await api.conversacion(aAna.id)).find((c) => c.id === mV.id);
  check(await lanza(() => api.reenviar(deAnaV, [aLuis.id])), 'la de Ana, no');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.marcarPresencia(false);
  check((await api.marcarEscuchado(deCoach.id)) === null && !(await b.sql(`select escuchado_en from comentarios where id = $1`, [deCoach.id]))[0].escuchado_en, 'con «en línea» apagado, escucharla no se apunta');
  await api.marcarPresencia(true);
  check(!!(await api.marcarEscuchado(deCoach.id)), 'y con él encendido, sí');
  // Encuestas
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const envio = {};
  const e1 = await api.crearEncuestaChat({ atletaId: aAna.id, pregunta: '  ¿Qué día hacemos el test?  ', opciones: ['Lunes', '', 'Jueves'], envio });
  const e1b = await api.crearEncuestaChat({ atletaId: aAna.id, pregunta: '¿Qué día hacemos el test?', opciones: ['Lunes', 'Jueves'], envio });
  check(e1.enviados === 1 && e1b.enviados === 0, 'el coach manda una encuesta (las opciones vacías no cuentan); repetida con el mismo envío, no se duplica');
  check(await lanza(() => api.crearEncuestaChat({ atletaId: aAna.id, pregunta: 'x', opciones: ['Solo'] })) && await lanza(() => api.crearEncuestaChat({ atletaId: aAna.id, pregunta: '', opciones: ['a', 'b'] })), 'sin dos opciones o sin pregunta, no');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const conE = (await api.conversacion(aAna.id)).find((c) => c.encuesta);
  check(conE && conE.encuesta.pregunta === '¿Qué día hacemos el test?' && igual(conE.encuesta.opciones, ['Lunes', 'Jueves']) && conE.encuesta.voto === null, 'Ana la ve en su chat (sin votar)');
  check(igual(await api.votarEncuestaChat(conE.encuesta.id, [1]), [1]) && igual((await api.conversacion(aAna.id)).find((c) => c.id === conE.id).encuesta.voto, [1]), 'vota «Jueves» y se ve su voto');
  check(await lanza(() => api.editarMensaje(conE.id, 'otra')), 'el mensaje de una encuesta no se edita');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(igual((await api.conversacion(aAna.id)).find((c) => c.id === conE.id).encuesta.voto, [1]), 'el coach ve qué ha votado');
  let errFwE = '';
  try { await api.reenviar((await api.conversacion(aAna.id)).find((c) => c.id === conE.id), [aLuis.id]); } catch (e) { errFwE = e.message; }
  check(/Una encuesta no se reenvía/.test(errFwE), '(revisión) una encuesta no se reenvía (lo dice la base)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(!(await api.conversacion(aLuis.id)).some((c) => c.encuesta?.id === conE.encuesta.id) && await lanza(() => api.votarEncuestaChat(conE.encuesta.id, [0])), 'Luis ni la ve ni vota');
  // A una lista
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const lista = await api.guardarListaDifusion({ nombre: 'Encuesta API', miembros: [aAna.id, aLuis.id] });
  const e2 = await api.crearEncuestaChat({ listaId: lista.id, pregunta: '¿Venís el sábado?', opciones: ['Sí', 'No'], multiple: false });
  check(e2.enviados === 2, 'una encuesta a una lista: a cada uno, la suya');
  // Reacciones: cualquier emoji
  const r0 = await api.enviarMensaje(aAna.id, { texto: 'Reacciona', autor: 'coach' });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(await api.reaccionarMensaje(r0.id, '🔥') === '🔥' && await api.reaccionarMensaje(r0.id, '👍🏽') === '👍🏽' && await lanza(() => api.reaccionarMensaje(r0.id, 'ok')), 'cualquier emoji (también con tono de piel); texto, no');
  // Ir a una fecha
  check(await api.mensajesDesde(aAna.id, new Date(Date.now() - 3600000).toISOString()) >= 5 && await api.mensajesDesde(aAna.id, new Date(Date.now() + 3600000).toISOString()) === 0, 'ir a una fecha: cuántos mensajes hay desde ese día');
  // (v0.56) El aviso de privacidad: quien acepta la política la acepta en su versión actual (no le sale el aviso)
  const [anaPerfil] = await b.sql(`select perfil_id from atletas where id = $1`, [aAna.id]);
  check((await api.privacidadVista()).version === VERSION_LEGAL && (await api.privacidadVista()).enBase === true, 'Ana aceptó la política al activar su cuenta: ya consta como vista la actual');
  await b.sql(`delete from privacidad_vista`);
  check((await api.privacidadVista()).version === null, 'sin nada guardado, no ha visto ninguna');
  // Antes de la 034 (o sin conexión): en este móvil, por cuenta
  const guardadoLocal = new Map();
  globalThis.localStorage = { getItem: (k) => guardadoLocal.get(k) ?? null, setItem: (k, v) => guardadoLocal.set(k, String(v)), removeItem: (k) => guardadoLocal.delete(k) };
  const faltaPv = () => { const e = new Error('relation "public.privacidad_vista" does not exist'); e.code = '42P01'; return e; };
  const sinPv = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: b.rpc.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), insert: b.insert.bind(b),
    select: async (t, f) => { if (t === 'privacidad_vista') throw faltaPv(); return b.select(t, f); }, upsert: async (t, ...r) => { if (t === 'privacidad_vista') throw faltaPv(); return b.upsert(t, ...r); } });
  check((await sinPv.privacidadVista()).version === null && await sinPv.marcarPrivacidadVista(VERSION_LEGAL) === false && guardadoLocal.get(`fbe-privacidad-vista-${anaPerfil.perfil_id}`) === VERSION_LEGAL,
    'sin la 034: se guarda en este móvil (por cuenta)');
  check((await sinPv.privacidadVista()).version === VERSION_LEGAL && !(await b.sql(`select 1 from privacidad_vista`)).length, 'y ya no vuelve a salir en este móvil');
  // Con la 034: lo de este móvil pasa a la base sin decir nada (así no sale en sus otros móviles)
  check((await api.privacidadVista()).version === VERSION_LEGAL, 'con la base, cuenta lo del móvil');
  let pasada = false;
  for (let i = 0; i < 20 && !pasada; i++) { pasada = (await b.sql(`select version from privacidad_vista where usuario_id = $1`, [anaPerfil.perfil_id]))[0]?.version === VERSION_LEGAL; if (!pasada) await new Promise((r) => setTimeout(r, 25)); }
  check(pasada, '(y se pasa a la base: en sus otros móviles tampoco sale)');
  guardadoLocal.clear();
  check((await api.privacidadVista()).version === VERSION_LEGAL, 'en otro móvil (sin nada guardado), la base dice que ya la vio');
  check(await api.marcarPrivacidadVista('2099-01') === false && !guardadoLocal.size && (await api.privacidadVista()).version === VERSION_LEGAL && await api.marcarPrivacidadVista('nada') === false,
    'una versión «del futuro» o sin formato no se guarda (ni en la base ni en el móvil)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.privacidadVista()).version === null && await api.marcarPrivacidadVista() === true && (await api.privacidadVista()).version === VERSION_LEGAL && await api.privacidadVistaDe(anaPerfil.perfil_id) === null,
    'Luis tiene la suya (la marca al cerrar el aviso) y no ve la de Ana');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.privacidadVistaDe(anaPerfil.perfil_id))?.version === VERSION_LEGAL && await api.privacidadVistaDe(null) === null, 'el coach ve en la ficha qué versión ha visto Ana');
  delete globalThis.localStorage;
  await b.sql(`delete from listas_difusion`); await b.sql(`delete from chat_cupos`); await b.sql(`delete from presencia`);
}

console.log('\nv0.57: los vídeos de técnica (migración 035)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from fbe_privado.storage_por_borrar`);
  check(await api.video035() === true, 'la app sabe que la base tiene la 035');
  const [se] = await b.sql(`select se.id, se.ejercicio_id from sesion_ejercicios se join sesiones s on s.id = se.sesion_id join semanas w on w.id = s.semana_id join bloques bl on bl.id = w.bloque_id where bl.atleta_id = $1 order by se.id limit 1`, [aAna.id]);
  await b.sql(`insert into series (sesion_ejercicio_id, numero, kg, reps, rpe) values ($1, 3, 62.5, 5, 8.5) on conflict (sesion_ejercicio_id, numero) do update set kg = 62.5, reps = 5, rpe = 8.5`, [se.id]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const v = await api.subirArchivo(aAna.id, new Blob(['vídeo 057'], { type: 'video/mp4' }), { tipo: 'video_tecnica', sesion_ejercicio_id: se.id, serie_numero: 3, duracion_seg: 8 });
  const rep = await api.subirArchivo(aAna.id, new Blob(['otra vez'], { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: se.ejercicio_id, repite_de: v.id, duracion_seg: 6 });
  check(v.serie_numero === 3 && rep.repite_de === v.id, 'Ana envía un vídeo con su serie y otro que lo repite');
  let d = (await api.diario(aAna.id)).find((x) => x.id === v.id);
  check(d.serie?.texto === '62,5 kg × 5 @8,5' && d.serie.numero === 3 && d.estado.estado === 'enviado' && d.revision === null, 'el diario lo trae con su serie («62,5 kg × 5 @8,5») y «Enviado»');
  check(await api.marcarVideoVisto(v.id) === null && !(await b.sql(`select 1 from video_revisiones where archivo_id = $1`, [v.id])).length, 'si lo abre ella, no cuenta como visto');
  check(await lanza(() => api.guardarRevision(v, { puntuacion: 5 })) && await lanza(() => api.guardarPlantillaTecnica(se.ejercicio_id, ['x'])), 'ni se corrige ni toca las listas del coach');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const band = await api.bandeja();
  const enB = band.archivos.find((x) => x.id === v.id);
  check(enB?.serie?.texto === '62,5 kg × 5 @8,5' && enB.ejercicio?.id === se.ejercicio_id, 'en la bandeja del coach, con su ejercicio y su serie');
  const vis = await api.marcarVideoVisto(v.id);
  check(/^\d{4}-\d{2}-\d{2}$/.test(vis) && (await api.diario(aAna.id)).find((x) => x.id === v.id).estado.estado === 'visto', 'el coach lo abre: «Visto» (el día)');
  check(await lanza(() => api.guardarRevision(v, { puntuacion: 7 })) && await lanza(() => api.guardarRevision(v, { tempo: { reps: [[0, 1, 30]] } })) && await lanza(() => api.guardarRevision(v, { checklist: { puntos: [{ t: 'x', e: 'quizá' }] } })),
    'una nota fuera de 1 a 5, un tempo fuera del vídeo o unos puntos mal formados no se guardan');
  const r = await api.guardarRevision(v, { puntuacion: 4, checklist: [{ t: 'Rodillas', e: 'mal', s: 1.5 }, { t: 'Pies', e: null }], tempo: { reps: [[0.2, 1.4, 2.1]] } });
  check(r.puntuacion === 4 && r.checklist.puntos.length === 1 && r.tempo.reps.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(r.corregido_el) && r.atleta_id === aAna.id, 'la corrección: nota, el punto marcado (con su momento) y el tempo');
  // (revisión de seguridad, H1) abrirlo otra vez no cambia nada de la fila (ni su fecha de cambio)
  const [antesV] = await b.sql(`select actualizado_en::text a from video_revisiones where archivo_id = $1`, [v.id]);
  await api.marcarVideoVisto(v.id);
  check((await b.sql(`select actualizado_en::text a from video_revisiones where archivo_id = $1`, [v.id]))[0].a === antesV.a, '(revisión) abrir otra vez el vídeo no toca la corrección');
  const plant = await api.guardarPlantillaTecnica(se.ejercicio_id, [' Escápulas juntas ', 'Escápulas juntas', 'Codos a 45°']);
  check(igual(plant, ['Escápulas juntas', 'Codos a 45°']) && igual(await api.plantillaTecnica(se.ejercicio_id), plant), 'la lista del coach para ese ejercicio (sin repetidos)');
  // La voz del coach sobre el vídeo
  const voz = new File([new Uint8Array(2000)], 'voz.webm', { type: 'audio/webm' });
  const rv = await api.guardarVozVideo(v, voz, { inicio: 1.234, seg: 9.6, onda: Array(40).fill(30) });
  check(rv.voz_archivo_id && rv.voz?.ruta && Number(rv.voz_inicio) === 1.23 && rv.voz.duracion_seg === 10 && cuboDe(rv.voz.ruta) === 'voz', 'el coach graba su voz sobre el vídeo (una nota de voz en el bucket «voz», desde el 0:01,2)');
  const rv2 = await api.guardarVozVideo(v, new File([new Uint8Array(1500)], 'v.webm', { type: 'audio/webm' }), { inicio: 0, seg: 4 });
  check(rv2.voz_archivo_id !== rv.voz_archivo_id && !(await b.sql(`select 1 from archivos where id = $1`, [rv.voz_archivo_id])).length, 'grabarla otra vez cambia la de antes (que se borra)');
  check(await lanza(() => api.guardarVozVideo(v, new File([new Uint8Array(4 * 1048576)], 'g.webm', { type: 'audio/webm' }), { seg: 5 })) && await lanza(() => api.guardarVozVideo(v, new File(['x'], 'a.txt', { type: 'text/plain' }), { seg: 5 })),
    'una voz de más de 3 MB, o que no es audio, no');
  // El fotograma al chat de Ana (una foto del coach)
  const msg = await api.enviarFotograma(v, new Blob([new Uint8Array(300)], { type: 'image/jpeg' }), { texto: 'En el 0:01,5 de tu vídeo' });
  const [adj] = await b.sql(`select tipo, subido_por, mime, derivado_de from archivos where id = $1`, [msg.archivo_id]);
  check(msg.adjunto && adj.tipo === 'adjunto' && adj.subido_por === 'coach' && adj.mime === 'image/jpeg' && adj.derivado_de === v.id, 'el fotograma va al chat de Ana como una foto del coach (con el vídeo del que sale)');
  // (revisión de seguridad, M1) y no se reenvía a nadie: ni lo ofrece el chat ni lo deja la app
  const enChat = (await api.conversacion(aAna.id)).find((c) => c.id === msg.id);
  check(enChat?.fotograma === true && !reenviable(enChat, 'coach') && await lanza(() => api.reenviar(enChat, [aLuis.id])), '(revisión) el fotograma no se puede reenviar a otro atleta');
  // Ana: «Corregido», la corrección y la voz (que oye y no borra), y «Mi técnica»
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  d = (await api.diario(aAna.id)).find((x) => x.id === v.id);
  const rA = await api.revisionVideo(v.id);
  check(d.estado.estado === 'corregido' && rA.puntuacion === 4 && rA.voz?.ruta && /^pglite:\/\/voz\//.test(await api.urlArchivo(rA.voz.ruta, { tipo: 'audio' })), 'Ana ve «Corregido», la corrección y puede oír la voz');
  // (revisión de seguridad, H1) sin ninguna hora: de «Visto» y «Corregido», el día; la tabla (con horas) no la lee
  check(!Object.keys(rA).some((k) => /_en$/.test(k)) && /^\d{4}-\d{2}-\d{2}$/.test(rA.visto_el) && /^\d{4}-\d{2}-\d{2}$/.test(rA.corregido_el) && !Object.keys(d.revision).some((k) => /_en$/.test(k))
    && !(await b.select('video_revisiones', {})).length, '(revisión) Ana ve el día de «Visto» y de «Corregido», nunca la hora (ni lee la tabla con las horas)');
  const copiaAna = await api.exportar(aAna.id);
  check(copiaAna.video_correcciones?.some((x) => x.archivo_id === v.id && x.corregido_el && !('corregido_en' in x)), '(revisión) y su copia de datos lleva la corrección de sus vídeos, con días');
  check(await api.plantillaTecnica(se.ejercicio_id) === null && await lanza(() => api.quitarVozVideo(v)) === false && (await api.revisionVideo(v.id)).voz_archivo_id === rv2.voz_archivo_id,
    'no ve las listas del coach ni le quita la voz (la base no le deja: no cambia nada)');
  const mt = await api.miTecnica(aAna.id);
  const g = mt.find((x) => x.id === se.ejercicio_id);
  check(g && g.videos.some((x) => x.id === v.id) && g.videos.some((x) => x.id === rep.id) && g.puntos.length === 1 && g.ultima === 4, '«Mi técnica»: sus vídeos de ese ejercicio y su nota');
  check((await api.archivo(v.id))?.id === v.id && (await api.repeticionesDe(v.id)).map((x) => x.id).join() === rep.id && (await api.videoTecnica(v.id)).serie.texto === '62,5 kg × 5 @8,5',
    'el original, sus repeticiones y el vídeo de un aviso, con todo');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(await api.revisionVideo(v.id) === null && (await api.videoTecnica(v.id)) === null, 'Luis no ve nada de eso');
  // La limpieza (el coach)
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const viejo = await b.sql(`insert into archivos (atleta_id, tipo, ruta, fecha, bytes, creado_en, revisado_en) values ($1::uuid, 'video_tecnica', $1::text || '/v057-viejo.mp4', '2025-01-01', 7340032, '2025-01-01', '2025-01-02') returning id`, [aLuis.id]);
  await b.sql(`insert into storage.objects (bucket_id, name) values ('archivos', $1)`, [`${aLuis.id}/v057-viejo.mp4`]);
  const pre = await api.limpiezaVideos({ meses: 6, dias: 30 });
  check(pre.n >= 1 && pre.lista.some((x) => x.id === viejo[0].id && x.atleta?.nombre === 'Luis Martín') && !pre.lista.some((x) => x.id === v.id) && pre.bytes >= 7340032, 'lo que se borraría, con de quién es y cuánto ocupa');
  check(pre.lote.n === pre.lista.length && pre.lote.bytes === pre.lista.reduce((t, x) => t + (Number(x.bytes) || 0), 0), '(revisión) y lo que se borra al confirmar (los que enseña la lista, como mucho 300)');
  check(await lanza(() => api.limpiezaVideos({ meses: 6, dias: 0 })), '(revisión) la conversación protege al menos 7 días');
  const hecho = await api.borrarVideosViejos({ meses: 6, dias: 30, ids: [viejo[0].id] });
  check(hecho.n === 1 && hecho.bytes === 7340032 && !(await b.sql(`select 1 from archivos where id = $1`, [viejo[0].id])).length
    && !(await b.sql(`select 1 from fbe_privado.storage_por_borrar`)).length && !(await b.sql(`select 1 from storage.objects where name = $1`, [`${aLuis.id}/v057-viejo.mp4`])).length,
    'se borra y la app del coach vacía la cola: el archivo sale de Storage');
  check(typeof (await api.bytesUsados()) === 'number' && (await api.bytesUsados()) > 0, 'lo que ocupa todo (para el aviso del panel)');
  // Sin la 035: lo de siempre, igual; lo nuevo dice qué falta (y un vídeo con serie sale igual, sin ella)
  {
    const falta = (t) => { const e = new Error(`relation "public.${t}" does not exist`); e.code = '42P01'; return e; };
    const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: async (n, a) => { if (/video|videos_/.test(n)) throw falta(n); return b.rpc(n, a); }, update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b),
      insert: async (t, f) => { if (Array.isArray(f) && f.some((x) => 'serie_numero' in x || 'repite_de' in x)) throw new Error('column "serie_numero" of relation "archivos" does not exist'); return b.insert(t, f); },
      select: async (t, f) => { if (['video_revisiones', 'tecnica_plantillas'].includes(t)) throw falta(t); return b.select(t, f); } });
    check(await sin.video035() === false && await sin.revisionVideo(v.id) === null && await sin.marcarVideoVisto(v.id) === null && await sin.plantillaTecnica(se.ejercicio_id) === null, 'sin la 035, la app lo sabe y no falla al leer');
    let m = '';
    try { await sin.guardarRevision(v, { puntuacion: 3 }); } catch (e) { m = e.message; }
    check(/Disponible tras la migración 035/.test(m), 'corregir dice «Disponible tras la migración 035»');
    await b.auth.entrar('ana@test', 'contraseña-ana-1');
    const sinSerie = await sin.subirArchivo(aAna.id, new Blob(['v'], { type: 'video/mp4' }), { tipo: 'video_tecnica', sesion_ejercicio_id: se.id, serie_numero: 3 });
    check(sinSerie.serie_numero == null && (await sin.diario(aAna.id)).find((x) => x.id === sinSerie.id).serie === null, 'y un vídeo con su serie se envía igual, sin ella');
    await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  }
  // 3. La subida por trozos sigue por donde iba (TUS, con un servidor de prueba)
  {
    const http = await import('node:http');
    const { subirPorTrozos } = await import('../web/src/datos/backend-supabase.js');
    const subidas = new Map(); let creadas = 0, recibidos = 0, cortar = 0;
    const srv = http.createServer((req, res) => {
      const cab = { 'Tus-Resumable': '1.0.0', 'Access-Control-Expose-Headers': 'Location, Upload-Offset' };
      const leer = () => new Promise((ok) => { const t = []; req.on('data', (x) => t.push(x)); req.on('end', () => ok(Buffer.concat(t))); });
      if (req.method === 'POST') {
        const idS = `s${++creadas}`; subidas.set(idS, { largo: Number(req.headers['upload-length']), off: 0 });
        leer().then((x) => { subidas.get(idS).off += x.length; recibidos += x.length; res.writeHead(201, { ...cab, Location: `http://localhost:${srv.address().port}/up/${idS}`, 'Upload-Offset': String(subidas.get(idS).off) }); res.end(); });
        return;
      }
      const idS = req.url.split('/').pop(); const u = subidas.get(idS);
      if (!u) { res.writeHead(404, cab); res.end(); return; }
      if (req.method === 'HEAD') { res.writeHead(200, { ...cab, 'Upload-Offset': String(u.off), 'Upload-Length': String(u.largo), 'Cache-Control': 'no-store' }); res.end(); return; }
      if (req.method === 'PATCH') {
        if (cortar > 0) { cortar--; req.socket.destroy(); return; }
        leer().then((x) => { u.off += x.length; recibidos += x.length; res.writeHead(204, { ...cab, 'Upload-Offset': String(u.off) }); res.end(); });
        return;
      }
      res.writeHead(405, cab); res.end();
    });
    await new Promise((ok) => srv.listen(0, ok));
    const endpoint = `http://localhost:${srv.address().port}/up`;
    const datos = Buffer.alloc(13 * 1048576, 7);
    let url = null; const pasos = [];
    cortar = 1;
    let corte = null;
    try { await subirPorTrozos({ endpoint, token: 't', anonKey: 'k', ruta: 'a/b.mp4', archivo: datos, tipo: 'video/mp4', reintentos: [], alUrlSubida: (x) => { url = x; }, alProgreso: (x) => pasos.push(x) }); } catch (e) { corte = e; }
    const tras1 = recibidos;
    check(corte?.sinConexion && url && /\/up\/s1$/.test(url) && tras1 === 6 * 1048576, 'se corta a media subida: queda la dirección de la subida y lo ya subido (el primer trozo de 6 MB)');
    await subirPorTrozos({ endpoint, token: 't', anonKey: 'k', ruta: 'a/b.mp4', archivo: datos, tipo: 'video/mp4', reintentos: [], urlSubida: url, alProgreso: (x) => pasos.push(x) });
    check(creadas === 1 && recibidos === datos.length && subidas.get('s1').off === datos.length, 'con esa dirección sigue por donde iba: no vuelve a subir lo que ya estaba (13 MB en total)');
    await subirPorTrozos({ endpoint, token: 't', anonKey: 'k', ruta: 'a/c.mp4', archivo: Buffer.alloc(1000, 1), tipo: 'video/mp4', reintentos: [], urlSubida: `${endpoint}/caducada` });
    check(creadas === 2 && subidas.get('s2').off === 1000, 'si la dirección ya no vale (caducó), empieza otra subida');
    // (revisión de seguridad, L3) una dirección guardada que no es de este servidor de subidas no recibe nada (ni el token)
    let ajenas = 0;
    const otro = http.createServer((req, res) => { ajenas++; res.writeHead(204, { 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0' }); res.end(); });
    await new Promise((ok) => otro.listen(0, ok));
    await subirPorTrozos({ endpoint, token: 't', anonKey: 'k', ruta: 'a/d.mp4', archivo: Buffer.alloc(500, 1), tipo: 'video/mp4', reintentos: [], urlSubida: `http://localhost:${otro.address().port}/up/s1` });
    check(ajenas === 0 && creadas === 3, '(revisión) una dirección de subida de otro servidor no se usa: se empieza otra subida');
    const { urlSubidaValida } = await import('../web/src/datos/backend-supabase.js');
    const ep = 'https://x.supabase.co/storage/v1/upload/resumable';
    check(urlSubidaValida(`${ep}/abc`, ep) && urlSubidaValida(`${ep}/abc`, `${ep}/`) && !urlSubidaValida(ep, ep) && !urlSubidaValida(`${ep}/`, ep) && !urlSubidaValida(`${ep}x/abc`, ep)
      && !urlSubidaValida(`${ep}/../../../otra`, ep) && !urlSubidaValida('https://malo.example/storage/v1/upload/resumable/abc', ep) && !urlSubidaValida(`https://x.supabase.co@malo.example/storage/v1/upload/resumable/abc`, ep)
      && !urlSubidaValida('javascript:alert(1)', ep) && !urlSubidaValida(null, ep) && !urlSubidaValida(`${ep}/abc`, ''),
      '(revisión) solo valen las direcciones de este servidor de subidas («endpoint/…», sin «..» ni otro servidor)');
    otro.close();
    srv.close();
  }
}

console.log('\nv0.58: el análisis automático de los vídeos (migración 036)');
{
  const { limpiarAnalisis, repeticiones, calibracion, serieVelocidad } = await import('../web/src/logica/analisis.js');
  const { AVISO_036 } = await import('../web/src/datos/api.js');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const v = await api.subirArchivo(aAna.id, new Blob(['vídeo 058'], { type: 'video/webm' }), { tipo: 'video_tecnica', duracion_seg: 6 });
  // Un análisis como el de la app: 3 subidas de 80 cm, calibrado con un disco de 45 cm
  const p = []; for (let t = 0; t <= 5; t += 1 / 30) p.push([t, 0.5, (200 + 80 * (1 - Math.cos(2 * Math.PI * t / 1.6))) / 640]);
  const cal = calibracion(45, 90, 360, 640);
  const analisis = limpiarAnalisis({ barra: { p }, cal, reps: repeticiones(p, { cal }), pose: { lado: 'der', reps: [{ t: [0, 1.6], rodilla: 88, tronco: 35 }] } });
  check(await lanza(() => api.guardarAnalisis(v, analisis)), 'Ana no guarda el análisis de su vídeo (lo hace en su móvil, sin guardarlo)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await api.video036() === true && analisis.reps.length === 3, 'la app sabe que la base tiene la 036');
  check(await lanza(() => api.guardarAnalisis(v, { v: 1, barra: { p: [[0, 0.5, 0.5]] } })) && await lanza(() => api.guardarAnalisis(v, { v: 1, barra: { p: [[0, 0.5, 0.5], [7.5, 0.5, 0.5]] } }))
    && await lanza(() => api.guardarAnalisis(v, { ...analisis, pose: { lado: 'der', reps: [{ t: [0, 1], puntos: [[0.5, 0.5]] }] } })), 'uno mal formado, que se sale del vídeo o con los puntos del cuerpo en crudo, no se guarda');
  const r = await api.guardarAnalisis(v, analisis);
  check(r.analisis?.reps?.length === 3 && r.analisis.cal.cm === 45 && r.analisis.pose.reps[0].rodilla === 88 && /^\d{4}-\d{2}-\d{2}$/.test(r.corregido_el), 'el coach lo guarda en la corrección (y cuenta como corregido)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const rA = await api.revisionVideo(v.id);
  const d = (await api.diario(aAna.id)).find((x) => x.id === v.id);
  check(rA.analisis?.barra?.p?.length === analisis.barra.p.length && d.revision.analisis.reps[1].vm === analisis.reps[1].vm && d.estado.estado === 'corregido', 'Ana lo ve en su vídeo corregido (la trayectoria, las repeticiones y la pose)');
  const g = (await api.miTecnica(aAna.id)).find((x) => x.videos.some((y) => y.id === v.id));
  check(serieVelocidad(g.videos).length === 1 && serieVelocidad(g.videos)[0].y === Math.max(...analisis.reps.map((x) => x.vm)), '«Mi técnica» tiene su velocidad para la gráfica');
  check((await api.exportar(aAna.id)).video_correcciones.some((x) => x.archivo_id === v.id && x.analisis?.v === 1), 'y su copia de datos lo lleva');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(await api.revisionVideo(v.id) === null, 'Luis no lo ve');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.guardarAnalisis(v, null)).analisis === null, 'el coach lo quita');
  // Sin la 036: el análisis funciona en el móvil del coach, pero guardarlo dice qué falta (y lo de la 035, igual)
  {
    const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: b.rpc.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), insert: b.insert.bind(b),
      upsert: async (t, f, c) => { if (t === 'video_revisiones' && f.some((x) => 'analisis' in x)) { const e = new Error('column "analisis" of relation "video_revisiones" does not exist'); e.code = '42703'; throw e; } return b.upsert(t, f, c); },
      select: async (t, f) => { if (t === 'video_revisiones' && /analisis/.test(f?.cols || '')) { const e = new Error('column video_revisiones.analisis does not exist'); e.code = '42703'; throw e; } return b.select(t, f); } });
    let m = '';
    try { await sin.guardarAnalisis(v, analisis); } catch (e) { m = e.message; }
    check(await sin.video035() === true && await sin.video036() === false && m === AVISO_036 && m === 'Disponible tras la migración 036' && (await sin.revisionVideo(v.id))?.archivo_id === v.id,
      'sin la 036, la app lo sabe: guardar dice «Disponible tras la migración 036» y la corrección se lee igual');
  }
  // (revisión de seguridad, L3) Un error de red (o cualquiera que no sea «falta la columna») no es «la 036 está» ni «no
  // está»: no se sabe, no se recuerda y se vuelve a mirar; al guardar, sale el error de verdad
  {
    let mirar = 0, red = true;
    const caido = () => new Error('TypeError: Failed to fetch');
    const conRed = crearApi({ ...b, auth: b.auth, storage: b.storage, rpc: b.rpc.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), insert: b.insert.bind(b),
      upsert: async (t, f, c) => { if (red && t === 'video_revisiones') throw caido(); return b.upsert(t, f, c); },
      select: async (t, f) => { if (t === 'video_revisiones' && /analisis/.test(f?.cols || '')) { mirar++; if (red) throw caido(); } return b.select(t, f); } });
    const primera = await conRed.video036();
    const segunda = await conRed.video036();
    let m = '';
    try { await conRed.guardarAnalisis(v, analisis); } catch (e) { m = e.message; }
    check(primera === null && segunda === null && mirar >= 3 && /Failed to fetch/.test(m) && !/migración 036/.test(m),
      '(revisión) sin conexión, la 036 queda «no se sabe» (no «está»), se vuelve a mirar cada vez y guardar enseña el error de verdad');
    red = false;
    check(await conRed.video036() === true && (await conRed.guardarAnalisis(v, analisis)).analisis?.v === 1, '(revisión) y con la red de vuelta, se sabe y se guarda');
    await conRed.guardarAnalisis(v, null);
  }
}

console.log('\nv0.59: los vídeos de técnica, tanda A (migración 037)');
{
  const { AVISO_037 } = await import('../web/src/datos/api.js');
  const { limpiarAutoevaluacion } = await import('../web/src/logica/correccion.js');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  const [aLuis] = await b.sql(`select id from atletas where email = 'luis@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = any($1::uuid[])`, [[aAna.id, aLuis.id]]);
  await b.sql(`delete from fbe_privado.storage_por_borrar`); await b.sql(`delete from chat_cupos`);
  const sent = await api.crear('ejercicios', { nombre: 'Sentadilla con barra v059', grupos_musculares: ['cuadriceps', 'gluteo'] });
  check(await api.video037() === true, 'la app sabe que la base tiene la 037');
  // 12. Ana envía un vídeo con su valoración
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.darConsentimientos(['datos_salud']).catch(() => {});
  const auto = limpiarAutoevaluacion({ rpe: 8.5, nota: 'Me cuesta el final', molestia: true, zona: 'zona_lumbar' }, { salud: true });
  const v1 = await api.subirArchivo(aAna.id, new Blob(['vídeo 059 a'], { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 8, autoevaluacion: auto });
  check(v1.autoevaluacion?.molestia === true && Number(v1.autoevaluacion.rpe) === 8.5 && !v1.autoevaluacionError, 'Ana envía un vídeo con su valoración (RPE, lo que nota y una molestia)');
  const a2 = await api.guardarAutoevaluacion(v1, { rpe: 9, nota: 'Mejor', molestia: true, zona: 'rodilla' }, { salud: false });
  check(a2.molestia === null && a2.zona === null && Number(a2.rpe) === 9, 'sin decir que tiene consentimiento de salud, la app no manda la molestia');
  check((await api.autoevaluacion(v1.id))?.nota === 'Mejor', 'y la lee');
  const v2 = await api.subirArchivo(aAna.id, new Blob(['vídeo 059 b'], { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 8 });
  const v3 = await api.subirArchivo(aAna.id, new Blob(['vídeo 059 c'], { type: 'video/mp4' }), { tipo: 'video_tecnica', ejercicio_id: sent.id, duracion_seg: 8 });
  check(await lanza(() => api.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: 'Yo misma' })) && await lanza(() => api.guardarFrase({ texto: 'Mía' })), 'Ana no fija recordatorios ni guarda frases');
  // El coach: la bandeja trae lo que nota; corrige dos vídeos; fija recordatorios y frases
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const enB = (await api.bandeja()).archivos.find((x) => x.id === v1.id);
  check(enB?.autoevaluacion?.nota === 'Mejor' && (await api.autoevaluacion(v1.id))?.rpe != null, 'en la bandeja del coach, cada vídeo con lo que nota el atleta');
  check(await lanza(() => api.guardarAutoevaluacion(v1, { rpe: 6 })), 'el coach no la cambia');
  await api.guardarRevision(v2, { puntuacion: 3, checklist: [{ t: 'Pecho arriba', e: 'mal', s: 1.5 }, { t: 'Pies', e: 'bien' }] });
  await api.guardarRevision(v3, { puntuacion: 4 });
  const sug = await api.sugerenciasRecordatorio(aAna.id, sent.id);
  check(sug.length === 1 && sug[0].texto === 'Pecho arriba' && sug[0].archivoId === v2.id && sug[0].segundo === 1.5, '14. se propone fijar lo marcado a corregir del último vídeo corregido, con su momento');
  const r1 = await api.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: sug[0].texto, archivoId: sug[0].archivoId, segundo: sug[0].segundo });
  await api.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: 'Aire antes de bajar' });
  await api.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: 'x'.repeat(200) });
  check(r1.archivo_id === v2.id && Number(r1.segundo) === 1.5 && await lanza(() => api.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: 'El cuarto' })), 'el coach los fija (como mucho 3 activos)');
  const lista = await api.recordatoriosCoach(aAna.id, sent.id);
  check(lista.length === 3 && lista.some((r) => [...r.texto].length === 140 && r.texto.endsWith('…')) && (await api.sugerenciasRecordatorio(aAna.id, sent.id)).length === 0, 'un texto largo se corta en 140 (con «…»); lo ya fijado no se vuelve a proponer');
  await api.editarRecordatorio(lista.find((r) => r.texto.startsWith('xxx')).id, { activo: false });
  await api.editarRecordatorio(r1.id, { texto: 'Pecho arriba al subir' });
  // 4. Frases
  check((await api.frasesCorreccion(sent.id)).length === 0, 'sin frases guardadas, ninguna en la base (las sugeridas son de la app)');
  const sugeridas = await api.guardarFrasesSugeridas(sent);
  const f1 = await api.guardarFrase({ ejercicioId: null, texto: 'Muy bien: así', dibujo: { t: 0, formas: [{ tipo: 'flecha', p: [[0.2, 0.2], [0.5, 0.5]] }] } });
  check(sugeridas.length >= 3 && sugeridas.every((f) => f.ejercicio_id === sent.id) && (await api.guardarFrasesSugeridas(sent)).filter((f) => f.ejercicio_id === sent.id).length === sugeridas.length, 'el coach guarda las sugeridas de su ejercicio (dos veces, sin repetirlas)');
  const todas = await api.frasesCorreccion(sent.id);
  check(todas.length === sugeridas.length + 1 && todas.at(-1).id === f1.id && todas.at(-1).dibujo?.formas?.length === 1 && await lanza(() => api.guardarFrase({ texto: 'Mal dibujo', dibujo: { t: 0, formas: [] } })),
    'las del ejercicio y luego las de todos (con su dibujo); un dibujo mal formado, no');
  await api.guardarFrase({ id: todas[0].id, ejercicioId: sent.id, texto: 'Cambiada', orden: 0 });
  await api.borrarFrase(todas[1].id);
  check((await api.frasesCorreccion(sent.id)).some((f) => f.texto === 'Cambiada') && !(await api.frasesCorreccion(sent.id)).some((f) => f.id === todas[1].id), 'las cambia y las borra');
  // 6. Vídeos modelo
  const m1 = await api.subirVideoModelo(sent, new File([new Uint8Array(3000)], 'demo.mp4', { type: 'video/mp4' }), { angulo: 'De lado', poster: new Blob([new Uint8Array(200)], { type: 'image/jpeg' }), duracion_seg: 4.4 });
  check(/^modelos\/[0-9a-f-]{36}\/modelo-[A-Za-z0-9]+\.mp4$/.test(m1.ruta) && m1.poster_ruta === `${m1.ruta}.jpg` && m1.duracion_seg === 4 && (await b.sql(`select 1 from storage.objects where name = any($1)`, [[m1.ruta, m1.poster_ruta]])).length === 2,
    'el coach sube su vídeo modelo (y su miniatura) a modelos/<ejercicio>/');
  check(await lanza(() => api.subirVideoModelo(sent, new File(['x'], 'a.txt', { type: 'text/plain' }))), 'solo un vídeo');
  // 15. Las marcas a mano y 18. los tiempos de la cola
  check(igual(await api.guardarRepsManual(v1, [2.5, 0.5, 4.5]), [0.5, 2.5, 4.5]) && igual(await api.repsManual(v1.id), [0.5, 2.5, 4.5]) && await lanza(() => api.guardarRepsManual(v1, [1, 9.5])), '15. el coach guarda sus marcas de repetición (en orden y dentro del vídeo)');
  const est = await api.estadisticasRevision();
  check(est.n30 >= 2 && est.mediana != null && est.p90 >= est.mediana && est.semana >= 2 && est.pendientes >= 1 && est.masAntiguo != null, `18. los tiempos de la cola (mediana ${est.mediana} h, p90 ${est.p90} h, ${est.semana} esta semana, ${est.pendientes} esperando)`);
  // Ana: sus recordatorios activos, los vídeos modelo, su mejor vídeo
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const recs = await api.recordatoriosActivos(aAna.id);
  check(recs.length === 2 && recs.some((r) => r.texto === 'Pecho arriba al subir' && r.archivo_id === v2.id) && recs.every((r) => !Object.keys(r).some((k) => /_en$/.test(k))), 'Ana ve sus 2 recordatorios activos (sin horas), con el vídeo corregido');
  const mods = await api.videosModelo([sent.id]);
  check(mods.length === 1 && mods[0].angulo === 'De lado' && /^pglite:\/\/modelos\//.test(await api.urlModelo(mods[0])) && /^pglite:/.test(await api.urlArchivo(mods[0].poster_ruta)), 've el vídeo modelo de su coach (y lo abre con su enlace)');
  const mejor = await api.mejorVideoDe({ ...v1, ejercicio: { id: sent.id } });
  check(mejor?.id === v3.id && mejor.revision?.puntuacion === 4, '7. «Comparar con tu mejor»: el de mejor nota de ese ejercicio');
  check(igual(await api.repsManual(v1.id), []) && await lanza(() => api.guardarRepsManual(v1, [1])) && (await api.frasesCorreccion(sent.id)).length === 0, 'las marcas a mano y las frases son del coach');
  const copia = await api.exportar(aAna.id);
  check(copia.video_autoevaluacion?.some((x) => x.archivo_id === v1.id) && copia.recordatorios_tecnica?.length === 2, 'su copia de datos lleva su valoración y sus recordatorios');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.recordatoriosActivos(aAna.id)).length === 0 && (await api.autoevaluacion(v1.id)) === null && (await api.mejorVideoDe({ ...v1, ejercicio: { id: sent.id } })) === null && (await api.videosModelo([sent.id])).length === 1,
    'Luis no ve nada de Ana (el vídeo modelo, sí: es del coach)');
  // El coach lo borra: a la cola de Storage y sale de Storage
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const copiaC = await api.copiaCompleta();
  check(['recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion'].every((t) => Array.isArray(copiaC[t]) && copiaC[t].length > 0), 'la copia completa del coach lleva las cuatro tablas nuevas');
  check(await api.borrarVideoModelo(m1) === 'borrado' && !(await b.sql(`select 1 from storage.objects where name like 'modelos/%'`)).length && !(await b.sql(`select 1 from fbe_privado.storage_por_borrar`)).length
    && !(await api.videosModelo([sent.id])).length, 'borrar un vídeo modelo lo saca de Storage (por la cola)');
  // Sin la 037: lo de la v0.58 sigue igual; lo nuevo dice qué falta (y el vídeo sale igual, sin su valoración)
  {
    const falta = (t) => { const e = new Error(`relation "public.${t}" does not exist`); e.code = '42P01'; return e; };
    const tablas37 = ['recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion'];
    const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, update: b.update.bind(b), delete: b.delete.bind(b),
      rpc: async (n, a) => { if (/recordatorios_activos|videos_modelo_de/.test(n)) throw falta(n); return b.rpc(n, a); },
      insert: async (t, f) => { if (tablas37.includes(t)) throw falta(t); return b.insert(t, f); },
      upsert: async (t, f, c) => { if (tablas37.includes(t)) throw falta(t); return b.upsert(t, f, c); },
      select: async (t, f) => { if (tablas37.includes(t)) throw falta(t); return b.select(t, f); } });
    let m = '';
    try { await sin.fijarRecordatorio({ atletaId: aAna.id, ejercicioId: sent.id, texto: 'x' }); } catch (e) { m = e.message; }
    check(await sin.video037() === false && m === AVISO_037 && m === 'Disponible tras la migración 037' && (await sin.frasesCorreccion(sent.id)).length === 0 && (await sin.videosModelo([sent.id])).length === 0
      && (await sin.recordatoriosActivos(aAna.id)).length === 0 && (await sin.autoevaluacion(v1.id)) === null && (await sin.revisionVideo(v2.id))?.puntuacion === 3,
      'sin la 037, la app lo sabe: fijar dice «Disponible tras la migración 037», leer no falla y la corrección se lee igual');
    await b.auth.entrar('ana@test', 'contraseña-ana-1');
    const v4 = await sin.subirArchivo(aAna.id, new Blob(['vídeo 059 d'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 5, autoevaluacion: { rpe: 8, nota: null, molestia: null, zona: null } });
    check(v4?.id && /migración 037/.test(v4.autoevaluacionError || ''), 'y un vídeo con valoración sale igual (avisa de que la valoración no se ha guardado)');
    await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  }
  // (revisión) M2: la política 2026-12.1, solo con la 037. Sin ella (la app se publica antes de que se ejecute), la 2026-12,
  // exactamente como antes: la base de la 034 no admite «2026-12.1» y el aviso no vuelve a salir en cada visita
  {
    const { VERSION_LEGAL: VL } = await import('../web/src/legal.js');
    const PV = await import('../web/src/logica/privacidad.js');
    const previo = globalThis.localStorage;
    const local = new Map();
    globalThis.localStorage = { getItem: (k) => local.get(k) ?? null, setItem: (k, v) => local.set(k, String(v)), removeItem: (k) => local.delete(k) };
    const falta = (t) => { const e = new Error(`relation "public.${t}" does not exist`); e.code = '42P01'; return e; };
    const tablas37 = ['recordatorios_tecnica', 'frases_correccion', 'videos_modelo', 'video_autoevaluacion'];
    // (como la 034: «AAAA-MM» y nada más)
    const restriccion034 = (t, f) => { if (t === 'privacidad_vista' && [f].flat().some((x) => !/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(x.version))) throw new Error('new row for relation "privacidad_vista" violates check constraint "privacidad_vista_version_valida"'); };
    const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, update: b.update.bind(b), delete: b.delete.bind(b), rpc: b.rpc.bind(b),
      insert: async (t, f) => { if (tablas37.includes(t)) throw falta(t); restriccion034(t, f); return b.insert(t, f); },
      upsert: async (t, f, c) => { if (tablas37.includes(t)) throw falta(t); restriccion034(t, f); return b.upsert(t, f, c); },
      select: async (t, f) => { if (tablas37.includes(t)) throw falta(t); return b.select(t, f); } });
    await b.auth.entrar('ana@test', 'contraseña-ana-1');
    const [{ perfil_id: anaUid }] = await b.sql(`select perfil_id from atletas where id = $1`, [aAna.id]);
    const enBase = async () => (await b.sql(`select version from privacidad_vista where usuario_id = $1`, [anaUid]))[0]?.version || null;
    await b.sql(`delete from privacidad_vista where usuario_id = $1`, [anaUid]);
    // Sin la 037
    check(VL === '2026-12.21' && await sin.versionLegal() === '2026-12' && await api.versionLegal() === '2026-12.21', '(v0.73) la vigente: 2026-12.12 con la 037, la 043, la 044 y la 045 (la misma detección); sin la 037, 2026-12');
    check(PV.debeAvisarPrivacidad((await sin.privacidadVista()).version, await sin.versionLegal()) && await sin.marcarPrivacidadVista() === true && await enBase() === '2026-12',
      'sin la 037: quien no ha visto la 2026-12 la ve y, al cerrarla, la base guarda 2026-12 (lo que admite)');
    local.clear();
    check(!PV.debeAvisarPrivacidad((await sin.privacidadVista()).version, await sin.versionLegal()), 'y no vuelve a salir (tampoco en otro móvil)');
    check(await sin.marcarPrivacidadVista('2026-12.1') === false && await enBase() === '2026-12', '(la base de la 034 no admite «2026-12.1»: por eso no se manda)');
    local.set(`fbe-privacidad-vista-${anaUid}`, '2026-12.1');
    await sin.privacidadVista();
    await new Promise((r) => setTimeout(r, 60));
    check(await enBase() === '2026-12' && !PV.debeAvisarPrivacidad((await sin.privacidadVista()).version, await sin.versionLegal()), 'si este móvil ya vio la 2026-12.1, a una base sin la 037 no le manda nada que no admita');
    local.clear();
    // Con la 037: quien vio la 2026-12 ve solo lo nuevo, una vez
    const v = (await api.privacidadVista()).version;
    check(v === '2026-12' && PV.debeAvisarPrivacidad(v, await api.versionLegal())
      && PV.novedadesDesde(v, await api.versionLegal()).map((x) => x[3]).join() === '2026-12.21,2026-12.20,2026-12.19,2026-12.18,2026-12.17,2026-12.16,2026-12.15,2026-12.14,2026-12.13,2026-12.12,2026-12.11,2026-12.10,2026-12.9,2026-12.8,2026-12.7,2026-12.6,2026-12.5,2026-12.4,2026-12.3,2026-12.2,2026-12.1',
      'con la 037, quien vio la 2026-12 ve el aviso con solo lo nuevo (lo de la 2026-12.1 a la 2026-12.21)');
    check(await api.marcarPrivacidadVista() === true && await enBase() === '2026-12.21', 'al cerrarlo, la base guarda la 2026-12.21 (con la 043, revisiones de dos cifras; con la 045, la .14 desde la v0.104)');
    local.clear();
    check(!PV.debeAvisarPrivacidad((await api.privacidadVista()).version, await api.versionLegal()) && (await api.privacidadVista()).version === '2026-12.21', 'y ya no vuelve a salir (en ningún móvil)');
    check(await api.marcarPrivacidadVista('2026-12.9') === true && await enBase() === '2026-12.21' && await api.marcarPrivacidadVista('2026-12') === true && await enBase() === '2026-12.21', 'nunca hacia atrás (la base, comparando por partes: ni a la 2026-12.9 ni a la 2026-12)');
    await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
    check(/vigente \(2026-12\.21\)/.test(PV.textoPrivacidadVista(await api.privacidadVistaDe(anaUid), await api.versionLegal())), 'el coach lo ve en la ficha');
    globalThis.localStorage = previo;
  }
  await b.sql(`delete from recordatorios_tecnica`); await b.sql(`delete from frases_correccion`); await b.sql(`delete from chat_cupos`);
}

// v0.60: los vídeos de técnica, tanda B (primera mitad, migración 038): las respuestas en vídeo del hilo, dos ángulos con su
// desfase y el ritmo de la cámara lenta, contra la base de verdad; y sin la 038, lo de antes igual y lo nuevo diciendo qué falta
console.log('\nv0.60: respuestas en vídeo, dos ángulos y cámara lenta (migración 038)');
{
  const { AVISO_038 } = await import('../web/src/datos/api.js');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  await b.sql(`update archivos set creado_en = creado_en - interval '3 days'`);
  await b.sql(`delete from fbe_privado.storage_por_borrar`); await b.sql(`delete from chat_cupos`);
  check(await api.video038() === true, 'la app sabe que la base tiene la 038');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const s1 = await api.subirArchivo(aAna.id, new Blob(['vídeo 060 a'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, fps_captura: 119.88 });
  const s2 = await api.subirArchivo(aAna.id, new Blob(['vídeo 060 b'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, angulo_de: s1.id });
  check(s1.fps_captura === 120 && s2.angulo_de === s1.id, '(11 y 9) Ana envía un vídeo grabado a 120 fps y otro como su otro ángulo (al enviarlo)');
  check((await api.parejaAngulo(s1))?.id === s2.id && (await api.parejaAngulo(s2))?.id === s1.id && !(await api.candidatosAngulo(s1)).some((x) => x.id === s2.id || x.id === s1.id),
    'la pareja de cada uno (de los dos lados); los ya enlazados no se proponen para otro');
  check(await lanza(() => api.enlazarAngulo({ ...s1, angulo_de: null }, s2.id)), 'ni se enlaza en cadena');
  // 2. Ana responde en el hilo con la cámara de delante; el coach, con su revisión grabada
  const cA = await api.responderConVideo(s1, new Blob(['webm'], { type: 'video/webm;codecs=vp8,opus' }), { autor: 'atleta', seg: 12.4 });
  check(cA?.video_respuesta_id && cA.archivo_id === s1.id && cA.texto === 'Vídeo', '(2) Ana responde en el hilo de su vídeo con un vídeo de 12 s (WebM)');
  let m = '';
  try { await api.responderConVideo(s1, new Blob(['x'], { type: 'video/mp4' }), { autor: 'atleta', seg: 75 }); } catch (e) { m = e.message; }
  check(/un minuto/.test(m) && await lanza(() => api.responderConVideo(s1, new Blob(['x'], { type: 'video/quicktime' }), { autor: 'atleta', seg: 5 })) && await lanza(() => api.responderConVideo(s1, new Blob([], { type: 'video/mp4' }), { autor: 'atleta', seg: 5 })),
    'de un minuto como mucho, MP4 o WebM y con algo dentro');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const cR = await api.responderConVideo(s1, new Blob(['mp4 de la revisión'], { type: 'video/mp4' }), { autor: 'coach', seg: 150, texto: 'Revisión grabada' });
  const hilo = await api.comentarios({ archivoId: s1.id });
  const vids = await api.videosDeRespuestas(hilo);
  check(cR.texto === 'Revisión grabada' && vids[cR.id]?.mime === 'video/mp4' && vids[cR.id].duracion_seg === 150 && vids[cA.id]?.mime === 'video/webm' && vids[cR.id].tipo === 'adjunto',
    '(1) el coach manda su revisión grabada (2:30): en el hilo, cada respuesta con su vídeo (archivos del chat de siempre)');
  check(!(await api.conversacion(aAna.id)).some((c) => c.id === cR.id && api.esMensaje(c)), 'y van en el hilo del vídeo (no como mensajes sueltos del chat)');
  // El desfase de los dos ángulos, con la corrección
  const j = await api.guardarDesfase(s1, s2.id, 0.0666);
  const [rev] = await api.correccionesDe([s1.id]);
  check(j.desfase === 0.067 && Number(rev.dos_angulos.desfase) === 0.067 && rev.corregido_el === null, '(9) el coach guarda el desfase (2 fotogramas) con la corrección, sin contar como corregido');
  check(await lanza(() => api.guardarDesfase(s1, s1.id, 0.5)), 'con su otro ángulo, no con otro');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(Number((await api.revisionVideo(s1.id))?.dos_angulos?.desfase) === 0.067 && await lanza(() => api.guardarDesfase(s1, s2.id, 0)), 'Ana lo lee (sin poder cambiarlo)');
  await api.desenlazarAngulo(s1);
  check((await api.parejaAngulo(s1)) === null && (await api.parejaAngulo(s2)) === null, 'Ana los desenlaza (desde cualquiera de los dos)');
  // Sin la 038: lo de antes igual; lo nuevo dice qué falta (y el vídeo sale igual, sin su ritmo ni su pareja)
  {
    const falta = (c) => { const e = new Error(`column comentarios.${c} does not exist`); e.code = '42703'; return e; };
    const con = (f) => JSON.stringify(f || {});
    const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, delete: b.delete.bind(b), rpc: b.rpc.bind(b),
      select: async (t, f) => { if (/video_respuesta_id|angulo_de|fps_captura|dos_angulos/.test(con(f))) throw falta('video_respuesta_id'); return b.select(t, f); },
      insert: async (t, f) => { if (/video_respuesta_id|angulo_de|fps_captura/.test(con(f))) throw falta('video_respuesta_id'); return b.insert(t, f); },
      update: async (t, c, f) => { if (/angulo_de/.test(con(c))) throw falta('angulo_de'); return b.update(t, c, f); },
      upsert: async (t, f, c) => { if (/dos_angulos/.test(con(f))) throw falta('dos_angulos'); return b.upsert(t, f, c); } });
    let m2 = '';
    try { await sin.responderConVideo(s1, new Blob(['x'], { type: 'video/mp4' }), { autor: 'atleta', seg: 5 }); } catch (e) { m2 = e.message; }
    const s3 = await sin.subirArchivo(aAna.id, new Blob(['vídeo 060 c'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, fps_captura: 120, angulo_de: s1.id });
    check(await sin.video038() === false && m2 === AVISO_038 && m2 === 'Disponible tras la migración 038' && s3?.id && s3.fps_captura == null && s3.angulo_de == null
      && await lanza(() => sin.enlazarAngulo(s3, s1.id)) && (await sin.parejaAngulo(s1)) === null && (await sin.revisionVideo(s1.id)) != null,
      'sin la 038, la app lo sabe: responder con vídeo y enlazar dicen «Disponible tras la migración 038», el vídeo sale igual (sin ritmo ni pareja) y la corrección se lee igual');
  }
  // Eliminar la respuesta para todos se lleva su vídeo
  const elim = await api.eliminarMensaje(cA).catch((e) => ({ error: e.message }));
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(!elim?.error && !(await b.sql(`select 1 from archivos where id = $1`, [cA.video_respuesta_id])).length, 'Ana elimina su respuesta en vídeo: su vídeo se va con ella');
  await b.sql(`delete from archivos where id = any($1::uuid[])`, [[s1.id, s2.id]]);
  // (revisión L4) Un envío que esperaba (con su ruta) y cuyo otro ángulo ya no está: sale igual, sin el enlace, y lo dice
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const p1 = await api.subirArchivo(aAna.id, new Blob(['vídeo 060 p'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6 });
  const pendiente = { tipo: 'video_tecnica', duracion_seg: 6, angulo_de: p1.id };
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await b.sql(`delete from archivos where id = $1`, [p1.id]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const p2 = await api.subirArchivo(aAna.id, new Blob(['vídeo 060 q'], { type: 'video/mp4' }), pendiente);
  check(p2?.id && p2.anguloPerdido === true && p2.angulo_de == null, '(L4) si su otro ángulo se ha borrado antes del reintento, el vídeo sale sin el enlace (y la app lo dice)');
  // (revisión H1) Borrar a un atleta con una respuesta en vídeo: primero la fila, después Storage (y la cola, vacía)
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const eva = await api.crearAtleta({ nombre: 'Atleta Borrable', email: 'borrable060@test' });
  await b.sql(`update atletas set estado = 'activo' where id = $1`, [eva.id]);
  const vEva = await api.subirArchivo(eva.id, new Blob(['vídeo eva'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6 });
  const cEva = await api.responderConVideo(vEva, new Blob(['revisión eva'], { type: 'video/mp4' }), { autor: 'coach', seg: 30 });
  const rutasEva = (await b.sql(`select ruta from archivos where atleta_id = $1`, [eva.id])).map((x) => x.ruta);
  let eB = null;
  try { await api.borrarAtleta(eva.id); } catch (e) { eB = e.message; }
  check(!eB && cEva?.video_respuesta_id && rutasEva.length === 2 && !(await b.sql(`select 1 from atletas where id = $1`, [eva.id])).length
    && !(await b.sql(`select 1 from storage.objects where name = any($1)`, [rutasEva])).length && !(await b.sql(`select 1 from fbe_privado.storage_por_borrar where ruta = any($1)`, [rutasEva])).length,
    `(H1) borrar a un atleta con una respuesta en vídeo: se borra la fila y después sus archivos de Storage (la cola, vacía)${eB ? ` (${eB})` : ''}`);
}

// v0.61: los vídeos de técnica, tanda B (segunda mitad, migración 039): revisar la sesión con su resumen, la velocidad
// mínima de cada ejercicio (solo el coach la cambia; el atleta la lee), el informe del mes con su tarjeta en el chat, contra
// la base de verdad; y sin la 039, lo de antes igual
console.log('\nv0.61: revisar la sesión, el perfil carga–velocidad y el informe del mes (migración 039)');
{
  const { AVISO_039 } = await import('../web/src/datos/api.js');
  const SV = await import('../web/src/logica/sesionVideos.js');
  const IT = await import('../web/src/logica/informeTecnica.js');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const [aAna] = await b.sql(`select id from atletas where email = 'ana@test'`);
  await b.sql(`update atletas set estado = 'activo' where id = $1`, [aAna.id]);
  await b.sql(`update archivos set creado_en = creado_en - interval '3 days'`);
  await b.sql(`delete from chat_cupos`);
  check(await api.video039() === true, 'la app sabe que la base tiene la 039');
  // Una sesión de Ana con dos ejercicios y sus series (hecha ayer)
  const [e1] = await b.sql(`insert into ejercicios (nombre) values ('Sentadilla v061') returning id`);
  const [e2] = await b.sql(`insert into ejercicios (nombre) values ('Press banca v061') returning id`);
  const [bl] = await b.sql(`insert into bloques (atleta_id, nombre, estado) values ($1, 'Bloque v061', 'activo') returning id`, [aAna.id]);
  const [se] = await b.sql(`insert into semanas (bloque_id, numero, programacion) values ($1, 1, 'programada') returning id`, [bl.id]);
  const ayer = sumarDias(hoyISO(), -1);
  const [ses] = await b.sql(`insert into sesiones (semana_id, orden, nombre, completada, fecha_realizada) values ($1, 1, 'Pierna v061', true, $2) returning id`, [se.id, ayer]);
  const [p1] = await b.sql(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series) values ($1, $2, 2, 3) returning id`, [ses.id, e1.id]);
  const [p2] = await b.sql(`insert into sesion_ejercicios (sesion_id, ejercicio_id, orden, series) values ($1, $2, 1, 3) returning id`, [ses.id, e2.id]);
  await b.sql(`insert into series (sesion_ejercicio_id, atleta_id, numero, kg, reps, rpe) values ($1, $3, 1, 80, 5, 8), ($1, $3, 2, 100, 5, 9), ($2, $3, 1, 60, 8, 8)`, [p1.id, p2.id, aAna.id]);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const vS = await api.subirArchivo(aAna.id, new Blob(['vídeo 061 s'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, sesion_ejercicio_id: p1.id, ejercicio_id: e1.id, serie_numero: 2 });
  const vP = await api.subirArchivo(aAna.id, new Blob(['vídeo 061 p'], { type: 'video/mp4' }), { tipo: 'video_tecnica', duracion_seg: 6, sesion_ejercicio_id: p2.id, ejercicio_id: e2.id, serie_numero: 1 });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const band = await api.bandeja();
  const mios = band.archivos.filter((a) => a.id === vS.id || a.id === vP.id);
  const pautas = Object.fromEntries(mios.map((a) => [a.sesion_ejercicio_id, a.pauta]));
  const ag = SV.agruparPorSesion(mios, pautas);
  check(mios.length === 2 && mios.every((a) => a.pauta?.sesion_id === ses.id && a.sesionVideo?.nombre === 'Pierna v061' && a.sesionVideo.fecha === ayer)
    && ag.grupos.length === 1 && ag.grupos[0].videos.map((v) => v.id).join() === `${vP.id},${vS.id}`,
    '(5) la bandeja trae la sesión de cada vídeo y su orden en ella: los dos de «Pierna» van juntos, en el orden de la sesión');
  const pr = await api.sesionParaRevisar(ses.id);
  check(pr.sesion.id === ses.id && pr.pautas.map((x) => x.id).join() === `${p2.id},${p1.id}` && pr.pautas[1].hechas.length === 2 && pr.pautas[1].ejercicio.nombre === 'Sentadilla v061' && pr.resumen === null,
    'con las series de la sesión (cada ejercicio con lo que hizo) y sin resumen aún');
  check(await lanza(() => api.enviarResumenSesion({ atletaId: aAna.id, sesionId: ses.id, texto: '   ' })), 'un resumen vacío no sale');
  // (revisión M2) con la 039, lo que cuenta es la marca de la base, no el texto
  const normal = await api.comentar({ atletaId: aAna.id, sesionId: ses.id, texto: 'Resumen de la sesión: esto es un mensaje normal', autor: 'coach' });
  check(normal.resumen_sesion === false && (await api.sesionParaRevisar(ses.id)).resumen === null, '(M2) un mensaje del coach que empieza igual no cuenta como resumen');
  const c = await api.enviarResumenSesion({ atletaId: aAna.id, sesionId: ses.id, texto: SV.borradorResumen([{ ...mios[0], ejercicio: { nombre: 'Sentadilla' } }], { nombre: 'Ana' }) + 'Muy bien.' });
  check(c?.sesion_id === ses.id && c.autor === 'coach' && c.resumen_sesion === true && c.texto.startsWith('Resumen de la sesión, Ana:') && (await api.sesionParaRevisar(ses.id)).resumen?.id === c.id, 'el resumen va al hilo de esa sesión, marcado por la base');
  let m = '';
  try { await api.enviarResumenSesion({ atletaId: aAna.id, sesionId: ses.id, texto: 'Resumen de la sesión: otra vez' }); } catch (e) { m = e.message; }
  let mDirecto = '';
  try { await b.insert('comentarios', [{ atleta_id: aAna.id, sesion_id: ses.id, texto: 'Otro texto', autor: 'coach', resumen_sesion: true }]); } catch (e) { mDirecto = e.message; }
  check(/Ya le has mandado el resumen/.test(m) && /Ya le has mandado el resumen/.test(mDirecto) && (await b.sql(`select count(*)::int n from comentarios where sesion_id = $1 and resumen_sesion`, [ses.id]))[0].n === 1,
    'y no se manda dos veces (tampoco saltándose la app: lo impide la base)');
  const avisos = await b.sql(`select titulo, cuerpo from notificaciones where clave = $1`, ['comentario:' + c.id]);
  check(avisos.length === 1 && !/Muy bien|Resumen/.test(`${avisos[0].titulo} ${avisos[0].cuerpo || ''}`), 'un solo aviso para toda la sesión, sin el texto');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check((await api.conversacion(aAna.id)).some((x) => x.id === c.id && x.contexto?.tipo === 'sesion' && x.contexto.nombre === 'Pierna v061'), 'Ana lo ve en su chat, con la sesión de contexto');

  // 16. La velocidad mínima de cada ejercicio (la escribe el coach; Ana la lee sin horas)
  check(await lanza(() => api.guardarUmbralVelocidad(e1.id, 0.3)), 'Ana no puede cambiar la velocidad mínima');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await api.guardarUmbralVelocidad(e1.id, 0.32) === 0.32 && await lanza(() => api.guardarUmbralVelocidad(e1.id, 0.04)) && await lanza(() => api.guardarUmbralVelocidad(e1.id, 0.1234)),
    'el coach pone 0,32 m/s a la sentadilla (y no algo fuera de rango ni con 4 decimales)');
  check(await api.guardarUmbralVelocidad(e1.id, 0.31) === 0.31 && (await api.umbralesVelocidad([e1.id, e2.id]))[e1.id] === 0.31, 'la cambia (una por ejercicio)');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const uA = await api.umbralesVelocidad([e1.id, e2.id]);
  check(uA[e1.id] === 0.31 && !(e2.id in uA) && Object.keys(uA).length === 1, 'Ana la lee para sus ejercicios (la del press, la de serie: sin fila)');
  const dp = await api.datosPerfilVelocidad(aAna.id, e1.id);
  check(dp.umbrales[e1.id] === 0.31 && dp.series.length === 2 && dp.con039, 'y lo que hace falta para su perfil (la velocidad mínima y sus series, para el 1RM por repeticiones)');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await api.guardarUmbralVelocidad(e1.id, null) === null && !Object.keys(await api.umbralesVelocidad([e1.id])).length, 'y vuelve a la de serie');

  // 17. El informe del mes y su tarjeta en el chat
  const mes = hoyISO().slice(0, 7);
  const r = await api.informeTecnica(aAna.id, mes);
  check(r.informe.mes === mes && r.informe.enviados >= 2 && r.videos.some((v) => v.id === vS.id), `(17) el informe de ${IT.textoMes(mes)} (${r.informe.enviados} vídeos)`);
  check(await lanza(() => api.informeTecnica(aAna.id, '2026-13')), 'un mes que no existe, no');
  check(await api.informeEnviado(aAna.id, mes) === false, 'aún no se lo ha mandado');
  const ci = await api.enviarInformeTecnica(aAna.id, mes);
  check(ci?.texto === IT.textoTarjetaInforme(mes) && !ci.sesion_id && !ci.archivo_id && await api.informeEnviado(aAna.id, mes) === true && await lanza(() => api.enviarInformeTecnica(aAna.id, mes)),
    'se lo manda: un mensaje del chat de siempre (una vez por mes)');
  const avI = await b.sql(`select url, titulo, cuerpo from notificaciones where clave = $1`, ['comentario:' + ci.id]);
  check(avI.length === 1 && avI[0].url === '#mensajes' && !/informe/i.test(`${avI[0].titulo} ${avI[0].cuerpo || ''}`), 'con un aviso al chat, sin el texto');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const enChat = (await api.conversacion(aAna.id)).find((x) => x.id === ci.id);
  check(IT.leerTarjetaInforme(enChat) === mes && (await api.informeTecnica(aAna.id, mes)).informe.enviados === r.informe.enviados, 'Ana lo ve como la tarjeta del informe y lo abre: el mismo informe que el coach');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');

  // Sin la 039: la velocidad mínima, la de serie (sin error) y cambiarla dice qué falta
  const falta = (t) => { const e = new Error(`relation "public.${t}" does not exist`); e.code = '42P01'; return e; };
  const sin = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: async (t, f) => { if (t === 'umbrales_velocidad') throw falta(t); return b.delete(t, f); },
    rpc: async (n, a) => { if (n === 'umbrales_velocidad_de') { const e = new Error('Could not find the function public.umbrales_velocidad_de'); e.code = 'PGRST202'; throw e; } return b.rpc(n, a); },
    upsert: async (t, f, c2) => { if (t === 'umbrales_velocidad') throw falta(t); return b.upsert(t, f, c2); },
    select: async (t, f) => { if (t === 'umbrales_velocidad') throw falta(t); return b.select(t, f); } });
  check(await sin.video039() === false && !Object.keys(await sin.umbralesVelocidad([e1.id])).length && (await sin.datosPerfilVelocidad(aAna.id, e1.id)).con039 === false, 'sin la 039, la app lo sabe y usa la de serie');
  let m39 = '';
  try { await sin.guardarUmbralVelocidad(e1.id, 0.3); } catch (e) { m39 = e.message; }
  check(m39 === AVISO_039 && (await sin.sesionParaRevisar(ses.id)).sesion.id === ses.id && (await sin.informeTecnica(aAna.id, mes)).informe.mes === mes,
    `y cambiarla dice «${AVISO_039}» (revisar la sesión y el informe funcionan igual)`);
  await b.sql(`delete from archivos where id = any($1::uuid[])`, [[vS.id, vP.id]]);
  await b.sql(`delete from comentarios where id = $1`, [ci.id]);
  await b.sql(`delete from bloques where id = $1`, [bl.id]);
}

// (v0.58.1) El historial del chat por páginas (400 y de 200 en 200), igual para el atleta que para el coach: con sus
// permisos de fila (lo programado del coach que aún no ha salido no lo ve ni le cuenta en la página) hasta el primero
console.log('\nv0.58.1: el historial del chat por páginas, para el atleta como para el coach');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const pag = await api.crearAtleta({ nombre: 'Atleta Paginada', email: 'paginada@test' });
  const codP = await api.crearInvitacion(pag.id);
  await b.auth.registrar('paginada@test', 'contraseña-paginada-1', 'Paginada');
  await api.canjearCodigo(codP);
  await api.darConsentimientos();
  // 650 antiguos (uno por hora desde hace 60 días; la prueba los pone tal cual, sin los disparadores que fechan «ahora»)
  await b.guion(`set session_replication_role = replica;
    insert into comentarios (atleta_id, autor, texto, creado_en)
      select '${pag.id}', case when i % 2 = 0 then 'atleta' else 'coach' end, 'Antiguo ' || i, now() - interval '60 days' + i * interval '1 hour' from generate_series(0, 649) i;
    set session_replication_role = default;`);
  await api.enviarMensaje(pag.id, { texto: 'Hoy, del atleta', autor: 'atleta' });
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.enviarMensaje(pag.id, { texto: 'Hoy, del coach (difusión larga) '.repeat(20), autor: 'coach' });
  await api.enviarMensaje(pag.id, { texto: 'Programado para mañana', autor: 'coach', enviarEn: new Date(Date.now() + 864e5).toISOString() });
  const paginas = async () => { const out = []; for (const limite of [400, 600, 800]) out.push(await api.conversacion(pag.id, { limite })); return out; };
  const [c400, c600, c800] = await paginas();
  await b.auth.entrar('paginada@test', 'contraseña-paginada-1');
  const [a400, a600, a800] = await paginas();
  const ids = (xs) => xs.map((c) => c.id).join();
  const sinProg = (xs) => xs.filter((c) => !c.programado);
  check(c400.length === 400 && a400.length === 400 && c400.at(-1).programado && !a400.some((c) => c.enviar_en) && a400.at(-1).texto.startsWith('Hoy, del coach'),
    '(v0.58.1) la primera página: 400 para los dos (el atleta, sin el programado; lo último que ve, la difusión de hoy)');
  check(a600.length === 600 && a600.slice(-400).map((c) => c.id).join() === ids(a400) && ids(sinProg(c600).slice(-599)) === ids(a600.slice(-599)),
    '(v0.58.1) la página anterior (600): el atleta recibe 200 más antiguos, encima de lo que ya tenía, como el coach');
  check(a800.length === 652 && a800[0].texto === 'Antiguo 0' && ids(sinProg(c800)) === ids(a800) && c800.length === 653,
    '(v0.58.1) y la última: hasta el primer mensaje de todos (652 para el atleta, 653 con el programado para el coach)');
  check(await api.mensajesDesde(pag.id, new Date(Date.now() - 60 * 864e5 - 3600e3).toISOString()) === 652, '(v0.58.1) «ir a una fecha» cuenta lo que ve el atleta (sin el programado)');
}

console.log('\nv0.67: «Revisión semanal»');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const hoyR = '2026-11-07'; // un sábado
  const r1 = await api.revisionSemanal(hoyR);
  const una = r1.filas[0];
  check(r1.lunes === '2026-11-02' && r1.revisiones === true && r1.filas.length >= 1 && 'sesiones' in una && 'mensajes' in una && 'videos' in una && una.hecha === false && una.nota === '',
    'la semana del lunes de hoy, con la 040: cada atleta con sus sesiones, mensajes sin leer, vídeos sin revisar y la revisión sin marcar');
  await api.marcarRevision(una.atleta_id, r1.lunes, { hecha: true });
  await api.marcarRevision(una.atleta_id, r1.lunes, { nota: '  Subir 2,5 kg en sentadilla  ' });
  const r2 = (await api.revisionSemanal(hoyR)).filas.find((f) => f.atleta_id === una.atleta_id);
  check(r2.hecha === true && r2.nota === 'Subir 2,5 kg en sentadilla', 'marcarla y la nota se guardan por separado (la nota no desmarca la casilla), sin espacios de más');
  const r3 = (await api.revisionSemanal('2026-11-10')).filas.find((f) => f.atleta_id === una.atleta_id);
  check(r3.hecha === false && r3.nota === '' && r3.notaAnterior === 'Subir 2,5 kg en sentadilla', 'el lunes siguiente empieza sin marcar, con la nota de la semana pasada a la vista');
  let largo = null;
  try { await api.marcarRevision(una.atleta_id, r1.lunes, { nota: 'x'.repeat(501) }); } catch (e) { largo = e.message; }
  check(/500/.test(largo || ''), 'una nota de más de 500 caracteres se rechaza con un aviso claro');
}

console.log('\nv0.69: la comunidad, primera tanda (041)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.abrirComunidad(true);
  for (const [email, clave, nombre] of [['ana@test', 'contraseña-ana-1', 'Ana L.'], ['luis@test', 'contraseña-luis-1', 'Luis M.']]) {
    await b.auth.entrar(email, clave);
    const m = await api.miembroComunidad();
    if (!api.dentroDeComunidad(m)) await api.entrarComunidad(nombre);
  }
  // (v0.80) la tarjeta de bienvenida dura 24 horas: Luis entró hace 12
  await b.sql(`update comunidad_miembros set creado_en = now() - interval '12 hours' where nombre = 'Luis M.'`);
  await b.sql(`update comunidad_miembros set creado_en = now() - interval '30 days' where nombre = 'Ana L.'`);
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(await api.comunidad041() === true, 'la app sabe que la base tiene la 041');
  const nuevos = await api.nuevosComunidad();
  check(nuevos.length === 1 && nuevos[0].nombre === 'Luis M.' && nuevos[0].bienvenida === false, 'Ana ve que Luis acaba de entrar');
  await api.darBienvenida(nuevos[0].perfil_id);
  check((await api.nuevosComunidad())[0].bienvenida === true && await lanza(() => api.darBienvenida(nuevos[0].perfil_id)), 'le da la bienvenida (una vez)');
  const post = await api.publicarEnComunidad({ texto: 'Sentadilla hecha' });
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.bienvenidasRecibidas()).map((x) => x.nombre).join() === 'Ana L.', 'Luis ve quién le ha dado la bienvenida');
  const c1 = await api.comentarEnComunidad(post.id, '¡Vamos!');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  await api.comentarEnComunidad(post.id, 'Gracias', [], c1.id);
  await api.reaccionarComentario(c1.id);
  const lista = await api.comentariosComunidad(post.id);
  const resp = lista.find((c) => c.texto === 'Gracias');
  check(lista.every((c) => c.con041) && resp.responde_a === c1.id && lista.find((c) => c.id === c1.id).fuerza.join() === 'Ana L.' && lista.find((c) => c.id === c1.id).miFuerza,
    'responde al comentario de Luis y le da 💪 (con quién y si es el suyo)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check((await api.verEntrenandoComunidad(true)).ver_entrenando === true, 'Luis enciende «Que el equipo vea cuándo estoy entrenando»');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(Array.isArray(await api.entrenandoAhora()), '«Entrenando ahora» responde (vacío si nadie está entrenando)');
  const [libre] = await b.sql(`select s.id from sesiones s join semanas w on w.id = s.semana_id join bloques bl on bl.id = w.bloque_id
    where bl.atleta_id = (select id from atletas where perfil_id = $1) and s.completada and w.programacion = 'programada' and not exists (select 1 from comunidad_posts p where p.sesion_id = s.id) limit 1`, [api.uid()]);
  const id = libre ? await api.compartirEnEquipo(libre.id).catch(() => null) : null;
  check(!!id, 'compartir una sesión terminada devuelve su publicación');
  if (id) { await api.borrarDeComunidad({ id }); check(!(await api.muro()).posts.some((x) => x.id === id), 'compartir solo devuelve la publicación, y «Deshacer» la borra'); }
  // Sin la 041: los comentarios salen como antes (sin responder ni 💪), sin nuevos ni «entrenando ahora»
  const falta = (q) => new Error(`column comunidad_comentarios.responde_a does not exist (${q})`);
  const sin041 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b),
    select: async (t, f) => { if (t === 'comunidad_comentarios' && /responde_a/.test(f?.cols || '')) throw falta(t); if (['comunidad_bienvenidas', 'comunidad_comentario_reacciones'].includes(t)) throw falta(t); return b.select(t, f); },
    rpc: async (n, a) => { if (['comunidad_nuevos', 'comunidad_entrenando_ahora', 'comunidad_dar_bienvenida', 'comunidad_reaccionar_comentario', 'comunidad_entrenando_visible'].includes(n)) throw new Error(`Could not find the function public.${n} in the schema cache`); return b.rpc(n, a); } });
  const listaSin = await sin041.comentariosComunidad(post.id);
  let msg041 = null;
  try { await sin041.reaccionarComentario(c1.id); } catch (e) { msg041 = e.message; }
  check(listaSin.length === lista.length && listaSin.every((c) => !c.con041 && c.responde_a === null) && (await sin041.nuevosComunidad()).length === 0 && await sin041.entrenandoAhora() === null
    && await sin041.comunidad041() === false && /Disponible tras la migración 041/.test(msg041 || ''),
    'sin la 041: los comentarios como antes, sin nuevos ni «entrenando ahora», y lo nuevo dice «Disponible tras la migración 041»');
  await api.borrarDeComunidad(post);
}

console.log('\nv0.71: la comunidad, tercera tanda (migración 043), con la capa de datos');
{
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const p1 = await api.publicarEnComunidad({ texto: 'Una pregunta zz043 para el coach', tema: 'pregunta' });
  const m = await api.muro({ filtro: 'preguntas' });
  check(await api.comunidad043() === true && p1.tema === 'pregunta' && m.con043 && m.posts.some((x) => x.id === p1.id && x.fotos.length === 0 && x.guardado === false),
    'con la 043: publica una pregunta para el coach y sale en el filtro «Preguntas»');
  check(await api.guardarPost(p1.id) === true && (await api.muro({ filtro: 'guardados' })).posts.map((x) => x.id).join() === p1.id
    && (await api.muro({ buscar: 'ZZ043' })).posts.map((x) => x.id).join() === p1.id && (await api.muro()).posts.find((x) => x.id === p1.id)?.guardado === true,
    'guardar, «Guardados» y buscar, contra la base con sus permisos');
  const sin043 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), select: b.select.bind(b),
    rpc: async (n, a) => { if (n === 'comunidad_buscar') throw new Error('Could not find the function public.comunidad_buscar(p_texto) in the schema cache'); return b.rpc(n, a); } });
  const ms = await sin043.muro({ buscar: 'zz043' });
  let msg = null;
  try { await sin043.publicarEnComunidad({ texto: 'Dos fotos', fotos: [new Blob(['a']), new Blob(['b'])] }); } catch (e) { msg = e.message; }
  check(await sin043.versionLegal() === '2026-12.9' && await api.versionLegal() === '2026-12.21', 'la política: con la 037 pero sin la 043, la 2026-12.9 (la más nueva que admite esa base); con la 043, la 044 y la 045 y la 050, la 2026-12.14');
  check(await sin043.comunidad043() === false && !ms.con043 && ms.posts.length > 1 && ms.posts.every((x) => !x.guardado) && /disponible tras la migración 043/i.test(msg || ''),
    'sin la 043: el muro como antes (sin buscar ni guardados) y varias fotos dicen «Disponible tras la migración 043»');
  await api.borrarDeComunidad(p1);
}

console.log('\nv0.72: la comunidad, cuarta tanda (migración 044), con la capa de datos');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check(await api.comunidad044() === true, 'la app sabe que la base tiene la 044');
  const { fechaMadrid: fM, sumarDias: sD } = await import('../web/src/logica/fechas.js');
  const ev = await api.guardarEvento({ titulo: 'Quedada zz044', fecha: sD(fM(), 3), hora: '18:00', lugar: 'Retiro', descripcion: '', plazas: '' });
  check(ev.plazas === null && ev.descripcion === null && new Date(ev.empieza_en).toISOString() === (await import('../web/src/logica/fechas.js')).instanteMadrid(sD(fM(), 3), '18:00'),
    'el coach crea un evento con el día y la hora de Madrid (sin plazas: sin límite)');
  check(await lanza(() => api.guardarEvento({ titulo: '', fecha: sD(fM(), 3), hora: '18:00', lugar: 'Retiro' })) && await lanza(() => api.guardarEvento({ titulo: 'Ayer', fecha: sD(fM(), -1), hora: '18:00', lugar: 'Retiro' })),
    'sin título o en el pasado, no');
  const prog = await api.publicarEnComunidad({ texto: 'Programado zz044', publicarEn: new Date(Date.now() + 3600e3).toISOString() });
  const mc = await api.muro();
  check((await api.programadosComunidad()).some((x) => x.id === prog.id) && !mc.posts.some((x) => x.id === prog.id) && mc.con044,
    'un aviso programado sale en «Programados» del coach, no en su muro');
  await api.guardarPlantilla('Recordad hidrataros zz044');
  check((await api.plantillasComunidad()).map((x) => x.texto).join() === 'Recordad hidrataros zz044' && (await api.panelComunidad())?.semanas?.length === 4, 'plantillas y el panel (4 semanas)');
  await api.guardarModeracion({ palabras: 'zzpalabrota', lento: 0 });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  const anaUid = api.uid();
  const evs = await api.eventosComunidad();
  check(evs.some((x) => x.id === ev.id && x.miRespuesta === null) && await api.responderEvento(ev.id, true) === true
    && (await api.eventosComunidad()).find((x) => x.id === ev.id).van.join() === 'Ana L.', 'Ana ve el evento, se apunta y sale entre los que van');
  check(!(await api.muro()).posts.some((x) => x.id === prog.id) && await lanza(() => api.panelComunidad()) && await api.plantillasComunidad().then((x) => x.length === 0),
    'Ana no ve lo programado, ni el panel, ni las plantillas');
  const ret = await api.publicarEnComunidad({ texto: 'Una ZZPALABROTA aquí' });
  check(ret.retenida === true && (await api.muro()).posts.find((x) => x.id === ret.id)?.retenida === true, 'con una palabra filtrada, queda retenida (su autora la ve, con «pendiente de revisión»)');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  check(!(await api.muro()).posts.some((x) => x.id === ret.id) && (await api.eventosComunidad()).find((x) => x.id === ev.id).van.join() === 'Ana L.', 'Luis no ve lo retenido; ve que Ana va');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  check((await api.retenidosComunidad()).some((x) => x.id === ret.id && x.autor === 'Ana L.'), 'el coach lo tiene en «Pendiente de revisión»');
  await api.aprobarComunidad({ postId: ret.id });
  await api.destacarAtleta(anaUid, 'Por no fallar ni un día');
  await api.silenciarComunidad(anaUid, 24);
  check((await api.perfilComunidad(anaUid)).silenciado_hasta && (await api.silenciadosComunidad()).length === 1, 'el coach la silencia 24 h (lo ve en su perfil y en la lista)');
  await api.cambiarProgramado(prog.id, { publicarEn: null });
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  let msg = null;
  try { await api.publicarEnComunidad({ texto: 'Hola' }); } catch (e) { msg = e.message; }
  check(/pausado tus publicaciones/.test(msg || '') && !!(await api.miembroComunidad()).silenciado_hasta, 'silenciada, Ana no publica (y su fila dice hasta cuándo)');
  const m2 = await api.muro();
  check(m2.posts.some((x) => x.id === prog.id) && m2.posts.some((x) => x.id === ret.id && !x.retenida) && (await api.destacadoComunidad()).actual?.motivo === 'Por no fallar ni un día',
    '«Publicar ya» lo programado: Ana lo ve; lo aprobado también; y es la atleta de la semana');
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  await api.silenciarComunidad(anaUid, 0);
  await api.quitarDestacado();
  await api.guardarModeracion({ palabras: '', lento: 0 });
  await api.cancelarEvento(ev.id);
  for (const x of [prog, ret]) await api.borrarDeComunidad(x);
  for (const x of await api.plantillasComunidad()) await api.borrarPlantilla(x.id);
  // Sin la 044
  const falta = (t) => { const e = new Error(`Could not find the table 'public.${t}' in the schema cache`); e.code = 'PGRST205'; return e; };
  const sin044 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b),
    select: async (t, f) => { if (['comunidad_eventos', 'comunidad_plantillas', 'comunidad_destacados', 'comunidad_moderacion'].includes(t)) throw falta(t); if (t === 'comunidad_posts' && /publicar_en/.test(f?.cols || '')) throw new Error('column comunidad_posts.publicar_en does not exist'); return b.select(t, f); },
    rpc: async (n, a) => { if (n === 'comunidad_panel') throw new Error('Could not find the function public.comunidad_panel in the schema cache'); return b.rpc(n, a); } });
  let msg2 = null;
  try { await sin044.publicarEnComunidad({ texto: 'Programado', publicarEn: new Date(Date.now() + 3600e3).toISOString() }); } catch (e) { msg2 = e.message; }
  check(await sin044.comunidad044() === false && await sin044.versionLegal() === '2026-12.10' && await sin044.eventosComunidad() === null && await sin044.panelComunidad() === null
    && await sin044.plantillasComunidad() === null && await sin044.destacadoComunidad() === null && !(await sin044.muro()).con044 && /disponible tras la migración 044/i.test(msg2 || ''),
    'sin la 044: la política sigue en la 2026-12.10, no hay eventos, panel, plantillas ni atleta de la semana, el muro como antes y programar dice «Disponible tras la migración 044»');
}

console.log('\nv0.73: la comunidad, quinta tanda (migración 045), con la capa de datos');
{
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  check(await api.comunidad045() === true, 'la app sabe que la base tiene la 045');
  const anaUid = api.uid();
  const p = await api.publicarEnComunidad({ texto: 'Pierna hecha zz045' });
  const mom = await api.publicarMomento({ foto: new Blob(['jpeg'], { type: 'image/jpeg' }), texto: '  Atardecer   tras la sesión ' });
  check(mom.tipo === 'momento' && mom.texto === 'Atardecer tras la sesión' && await lanza(() => api.publicarMomento({ foto: new Blob(['x']), texto: 'x'.repeat(141) })) && await lanza(() => api.publicarMomento({ texto: 'Sin foto' })),
    'Ana publica un momento (una foto y una línea limpia); sin foto o con más de 140 letras, no');
  await b.auth.entrar('luis@test', 'contraseña-luis-1');
  const ms = await api.momentosComunidad();
  check(ms.some((x) => x.id === mom.id && x.autor.nombre === 'Ana L.' && !x.mio) && !(await api.muro()).posts.some((x) => x.id === mom.id), 'Luis lo ve en la tira de momentos, no en el muro');
  check(await api.reaccionar(mom.id, 'corazon') === 'corazon' && await api.reaccionar(p.id, 'trofeo') === 'trofeo' && (await api.momentosComunidad()).find((x) => x.id === mom.id).reacciones.corazon.length === 1,
    'reacciona con ❤️ al momento y con 🏆 a la publicación (con quién)');
  const c = await api.pegatinaEnComunidad(p.id, 'a_tope');
  const cs = await api.comentariosComunidad(p.id);
  check(c.texto === 'A tope' && cs.find((x) => x.id === c.id)?.pegatina === 'a_tope' && cs[0].con045 && await lanza(() => api.pegatinaEnComunidad(p.id, 'inventada'))
    && await lanza(() => api.comentarEnComunidad(mom.id, 'Qué bonito')), 'una pegatina como comentario (con su texto); un momento no se comenta');
  const m = await api.muro();
  check(m.con045 && m.posts.find((x) => x.id === p.id).reacciones.trofeo.length === 1, 'el muro sabe que hay reacciones nuevas');
  const mes = await api.mesEquipoComunidad();
  const hitos = await api.hitosComunidad();
  check(/^\d{4}-\d{2}$/.test(mes.mes) && Number.isInteger(mes.equipo.sesiones) && Number.isInteger(mes.yo.animos_recibidos) && hitos.length === 8 && hitos.every((x) => typeof x.alcanzado === 'boolean'),
    'el mes en el equipo (del equipo y el suyo) y los hitos');
  await b.auth.entrar('ana@test', 'contraseña-ana-1');
  for (const x of [p, mom]) await api.borrarDeComunidad(x);
  check(!(await api.momentosComunidad()).some((x) => x.id === mom.id) && anaUid, 'Ana borra su momento');
  // Sin la 045
  const sin045 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b),
    select: async (t, f) => { if (t === 'comunidad_comentarios' && /pegatina/.test(f?.cols || '')) throw new Error('column comunidad_comentarios.pegatina does not exist'); return b.select(t, f); },
    rpc: async (n, a) => { if (['comunidad_mes_equipo', 'comunidad_hitos'].includes(n)) throw new Error(`Could not find the function public.${n} in the schema cache`); return b.rpc(n, a); } });
  check(await sin045.comunidad045() === false && await sin045.versionLegal() === '2026-12.11' && await sin045.momentosComunidad() === null && await sin045.mesEquipoComunidad() === null
    && await sin045.hitosComunidad() === null && !(await sin045.muro()).con045,
    'sin la 045: la política sigue en la 2026-12.11, sin momentos, mes del equipo ni hitos, y el muro con las reacciones de siempre');
  // (v0.104) Sin la 050: la política se queda en la 2026-12.13 (no describe lo que esa base no guarda)
  const sin050 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), select: b.select.bind(b),
    rpc: async (n, a) => { if (['personal_mio', 'personal_guardar', 'personal_atletas', 'mensajes_coach', 'mensaje_coach_guardar'].includes(n)) throw new Error(`Could not find the function public.${n} in the schema cache`); return b.rpc(n, a); } });
  check(await sin050.personal050() === false && await sin050.versionLegal() === '2026-12.13' && await api.personal050() === true && await api.versionLegal() === '2026-12.21',
    'sin la 050: la política sigue en la 2026-12.13; con todo, la 2026-12.16');
  // (v0.107) Con la 050 de la v0.104 pero sin ampliar (sin la música): la 2026-12.14
  const sinMusica = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), select: b.select.bind(b),
    rpc: async (n, a) => { if (['musica_para', 'musica_coach_lista', 'musica_coach_guardar', 'personal_musica_abierta'].includes(n)) throw new Error(`Could not find the function public.${n} in the schema cache`); return b.rpc(n, a); } });
  check(await sinMusica.musica050() === false && await sinMusica.versionLegal() === '2026-12.14', 'con la 050 de antes, sin la música: la política se queda en la 2026-12.14');
  // (v0.110) Sin la 051: la 2026-12.15
  const sin051 = crearApi({ ...b, auth: b.auth, storage: b.storage, insert: b.insert.bind(b), update: b.update.bind(b), delete: b.delete.bind(b), upsert: b.upsert.bind(b), select: b.select.bind(b),
    rpc: async (n, a) => { if (['integraciones_mias', 'integracion_crear', 'integracion_quitar', 'calendario_opciones', 'salud_diaria_de', 'contactos', 'contacto_guardar', 'contacto_mio', 'copia_privada', 'atajos_lista', 'atajo_guardar'].includes(n)) throw new Error(`Could not find the function public.${n} in the schema cache`); return b.rpc(n, a); } });
  check(await sin051.integraciones051() === false && await sin051.versionLegal() === '2026-12.15', 'sin la 051: la política se queda en la 2026-12.15');
}

console.log('\nFecha de contratación en Datos (v0.73)');
{
  await b.auth.entrar('pelayo@fbe.test', 'contraseña-coach');
  const x = await api.crearAtleta({ nombre: 'Prueba Alta' });
  const r = await api.actualizarAtleta(x.id, { fecha_alta: '2025-03-14' });
  check(r.fecha_alta === '2025-03-14' && (await api.ficha(x.id)).atleta.fecha_alta === '2025-03-14', 'el coach pone el día que contrató el servicio');
  check(await lanza(() => api.actualizarAtleta(x.id, { fecha_alta: '2999-01-01' })) && await lanza(() => api.actualizarAtleta(x.id, { fecha_alta: '' }))
    && await lanza(() => api.actualizarAtleta(x.id, { fecha_alta: '14/03/2025' })), 'ni futura, ni vacía, ni con otro formato');
  await api.borrarAtleta(x.id);
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
