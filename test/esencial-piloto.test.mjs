// FBE Esencial, el piloto (logica/esencial-piloto.js y la demo): las filas y las cifras del panel de Atletas, y las
// encuestas de las semanas 6 y 12 como tarea de texto (mandarla, contestarla y leer las respuestas).
import { filaPiloto, cifrasPiloto, ENCUESTA_ESENCIAL, ENCUESTAS_ESENCIAL, TITULOS_ENCUESTA, LISTON_ESENCIAL } from '../web/src/logica/esencial-piloto.js';
import { crearBackendMemoria } from '../web/src/datos/backend-memoria.js';
import { semillaDemo } from '../web/src/datos/semilla-demo.js';
import { crearApi } from '../web/src/datos/api.js';
import { hoyISO, sumarDias } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };

console.log('Las filas');
const hoy = '2027-02-17';
const base = { modalidad: 'por_su_cuenta', estado: 'activo', bloque: { nombre: 'Novato 2 días · FBE Esencial' }, semana: { numero: 2 }, sesiones: { completadas: 1, total: 2 }, alertas: [], servicio: 'entrenamiento' };
const f1 = filaPiloto({ ...base, ultimaSesion: '2027-02-15' }, hoy);
check(f1.nivel === 'ok' && f1.semana === 'Semana 2 de «Novato 2 días · FBE Esencial»' && f1.ultima === 'Hace 2 días' && !f1.comida, 'al día: su semana, «Hace 2 días», en verde');
check(filaPiloto({ ...base, ultimaSesion: '2027-02-09' }, hoy).nivel === 'ambar' && filaPiloto({ ...base, ultimaSesion: '2027-02-06' }, hoy).nivel === 'rojo', 'a los 7 días sin entrenar, ámbar; a los 10, rojo');
check(filaPiloto({ ...base, ultimaSesion: hoy, alertas: [{ nivel: 'alerta', texto: 'Dolor 4/5 en la rodilla' }] }, hoy).nivel === 'rojo', 'con un aviso de alerta (dolor), rojo');
check(filaPiloto({ ...base, ultimaSesion: hoy, alertas: [{ nivel: 'info', texto: 'x' }] }, hoy).nivel === 'ok', 'un aviso suave no cuenta');
check(filaPiloto({ ...base, bloque: null, semana: null, ultimaSesion: null }, hoy).semana === 'Antes de empezar' && filaPiloto({ ...base, ultimaSesion: null }, hoy).ultima === 'Aún sin entrenar', 'antes de empezar y sin entrenar');
check(filaPiloto({ ...base, servicio: 'completo', ultimaSesion: hoy }, hoy).comida && filaPiloto({ ...base, ultimaSesion: hoy }, hoy).ultima === 'Entrenó hoy', 'con nutrición; «Entrenó hoy»');
check(filaPiloto({ ...base, semana: { numero: 1 }, ultimaSesion: null }, hoy).nivel === 'ok' && filaPiloto({ ...base, semana: { numero: 2 }, ultimaSesion: null }, hoy).nivel === 'ambar',
  'sin haber entrenado nunca: en su semana 1, en verde; en la 2 o después, ámbar');

console.log('\nLas cifras');
const c4 = (hechas, total) => ({ sesiones: { hechas, total, pct: Math.round((100 * hechas) / total) } });
const lista = [
  { ...base, atleta_id: 'a', ultimaSesion: '2027-02-16', cumplimiento: c4(7, 8) },
  { ...base, atleta_id: 'b', ultimaSesion: '2027-02-05', cumplimiento: c4(4, 8) },
  { ...base, atleta_id: 'c', estado: 'baja', ultimaSesion: '2027-01-20', cumplimiento: c4(2, 8) },
  { ...base, atleta_id: 'd', bloque: null, semana: null, ultimaSesion: null },
  { ...base, atleta_id: 'e', modalidad: null, ultimaSesion: hoy, cumplimiento: c4(8, 8) },
];
const enc = [{ atleta_id: 'a', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: '2027-02-16T10:00:00Z' }, { atleta_id: 'b', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: null }, { atleta_id: 'e', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: 'x' }];
const c = cifrasPiloto(lista, hoy, enc);
check(c.total === 4 && c.siguen === 3 && c.bajas === 1 && c.conPlan === 2 && c.entrenaron === 1, 'cuatro por su cuenta (el de seguimiento no cuenta): siguen 3, uno de baja, 2 con plan y 1 ha entrenado esta semana');
check(c.sesiones4.hechas === 11 && c.sesiones4.total === 16 && c.sesiones4.pct === 69 && !c.cumpleSesiones && LISTON_ESENCIAL.sesiones === 75, 'sesiones apuntadas de las pautadas en 4 semanas: 11 de 16 (69 %), por debajo del listón (75 %)');
check(c.encuesta.mandadas === 2 && c.encuesta.contestadas === 1, 'la encuesta: mandada a 2 de los suyos y contestada por 1');
const c12 = cifrasPiloto(lista, hoy, [...enc, { atleta_id: 'a', titulo: ENCUESTAS_ESENCIAL[1].titulo, hecha_en: null }]);
check(c12.encuesta.id === 's12' && c12.encuesta.mandadas === 1 && c12.encuesta.contestadas === 0 && c12.encuestas[0].mandadas === 2 && c12.encuestas[0].contestadas === 1,
  'la de la semana 12, aparte: mandada a 1 y sin contestar (la de la semana 6 sigue con 2 y 1)');
check(ENCUESTAS_ESENCIAL.every((e) => e.titulo.length <= 120 && e.detalle.length <= 600) && new Set(TITULOS_ENCUESTA).size === 2, 'las dos caben en una tarea y tienen títulos distintos (las respuestas se reconocen por él)');
check(ENCUESTA_ESENCIAL.titulo.length <= 120 && ENCUESTA_ESENCIAL.detalle.length <= 600 && /0 al 10/.test(ENCUESTA_ESENCIAL.detalle) && /19,99/.test(ENCUESTA_ESENCIAL.detalle),
  'la encuesta cabe en una tarea (título 120, detalle 600): recomendación del 0 al 10, qué ayuda y si pagaría el precio normal');

console.log('\nEn la demo: Pelayo manda la encuesta e Inés contesta');
const bd = crearBackendMemoria({ semilla: () => semillaDemo(hoyISO(), { esencial: true }), persistir: false });
const apiD = crearApi(bd);
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const res = await apiD.resumenes();
const cd = cifrasPiloto(res, hoyISO(), []);
check(cd.total === 4 && cd.siguen === 4 && cd.conPlan >= 2, `la demo: ${cd.total} por su cuenta, ${cd.conPlan} con plan`);
const suyos = res.filter((r) => r.modalidad === 'por_su_cuenta');
const n = await apiD.enviarEncuestaEsencial(suyos.map((r) => r.atleta_id), ENCUESTA_ESENCIAL);
const tareas = await apiD.encuestaEsencial(suyos.map((r) => r.atleta_id), ENCUESTA_ESENCIAL.titulo);
check(n === 4 && tareas.length === 4 && tareas.every((t) => t.tipo === 'texto' && t.detalle === ENCUESTA_ESENCIAL.detalle && !t.hecha_en), 'mandada a los cuatro: una tarea de texto con las preguntas');
const ines = suyos.find((r) => r.nombre === 'Inés Gil');
await bd.auth.entrar('ines@fbe.demo', 'demo');
const suya = (await apiD.tareas(ines.atleta_id)).find((t) => t.titulo === ENCUESTA_ESENCIAL.titulo);
await apiD.completarTarea(suya.id, { respuesta: '9. Me ayuda tener el plan hecho. Sí, seguiría.' });
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const despues = cifrasPiloto(res, hoyISO(), await apiD.encuestaEsencial(suyos.map((r) => r.atleta_id), TITULOS_ENCUESTA));
check(despues.encuesta.mandadas === 4 && despues.encuesta.contestadas === 1, 'Inés contesta: 1 de 4 contestadas, y Pelayo lee su respuesta');
check(sumarDias(hoy, 0) === hoy, '(fin)');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
