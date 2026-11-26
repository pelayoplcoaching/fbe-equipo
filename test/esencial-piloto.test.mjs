// FBE Esencial, el piloto (logica/esencial-piloto.js y la demo): las filas y las cifras del panel de Atletas, y las
// encuestas de las semanas 6 y 12 como tarea de texto (mandarla, contestarla y leer las respuestas).
import { filaPiloto, cifrasPiloto, ENCUESTA_ESENCIAL, ENCUESTAS_ESENCIAL, TITULOS_ENCUESTA, LISTON_ESENCIAL, embudoAlta, sinActivarAlta, semana1SinEmpezar, avisosDe } from '../web/src/logica/esencial-piloto.js';
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
const c4 = (hechas, total, sh = hechas * 3, sp = total * 3) => ({ sesiones: { hechas, total, pct: Math.round((100 * hechas) / total) }, series: { hechas: sh, pautadas: sp } });
const lista = [
  { ...base, atleta_id: 'a', ultimaSesion: '2027-02-16', cumplimiento: c4(7, 8) },
  { ...base, atleta_id: 'b', ultimaSesion: '2027-02-05', cumplimiento: c4(4, 8) },
  { ...base, atleta_id: 'c', estado: 'baja', ultimaSesion: '2027-01-20', cumplimiento: c4(2, 8) },
  { ...base, atleta_id: 'd', bloque: null, semana: null, ultimaSesion: null },
  { ...base, atleta_id: 'e', modalidad: null, ultimaSesion: hoy, cumplimiento: c4(8, 8) },
  { ...base, atleta_id: 'f', nombre: 'Nuria Sanz', estado: 'invitado', bloque: null, semana: null, ultimaSesion: null },
];
const enc = [{ atleta_id: 'a', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: '2027-02-16T10:00:00Z' }, { atleta_id: 'b', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: null }, { atleta_id: 'e', titulo: ENCUESTA_ESENCIAL.titulo, hecha_en: 'x' }];
const c = cifrasPiloto(lista, hoy, enc);
check(c.total === 4 && c.siguen === 3 && c.bajas === 1 && c.conPlan === 2 && c.entrenaron === 1, 'cuatro por su cuenta (el de seguimiento no cuenta): siguen 3, uno de baja, 2 con plan y 1 ha entrenado esta semana');
check(c.sinActivar.length === 1 && c.sinActivar[0] === 'Nuria Sanz' && c.total === 4, 'quien aún no ha activado su cuenta, aparte: «Sin activar su cuenta» (no cuenta entre los cuatro)');
check(c.series4.hechas === 33 && c.series4.pautadas === 48 && c.series4.pct === 69, 'las series pautadas hechas en esas 4 semanas: 33 de 48 (69 %)');
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
check(cd.total === 7 && cd.siguen === 7 && cd.conPlan >= 2, `la demo: ${cd.total} por su cuenta, ${cd.conPlan} con plan (con Lucía y Andrés, en la espera, desde la v0.248, y Carmen, desde la v0.250)`);
const suyos = res.filter((r) => r.modalidad === 'por_su_cuenta');
const n = await apiD.enviarEncuestaEsencial(suyos.map((r) => r.atleta_id), ENCUESTA_ESENCIAL);
const tareas = await apiD.encuestaEsencial(suyos.map((r) => r.atleta_id), ENCUESTA_ESENCIAL.titulo);
check(n === 7 && tareas.length === 7 && tareas.every((t) => t.tipo === 'texto' && t.detalle === ENCUESTA_ESENCIAL.detalle && !t.hecha_en), 'mandada a los siete: una tarea de texto con las preguntas');
const ines = suyos.find((r) => r.nombre === 'Inés Gil');
await bd.auth.entrar('ines@fbe.demo', 'demo');
const suya = (await apiD.tareas(ines.atleta_id)).find((t) => t.titulo === ENCUESTA_ESENCIAL.titulo);
await apiD.completarTarea(suya.id, { respuesta: '9. Me ayuda tener el plan hecho. Sí, seguiría.' });
await bd.auth.entrar('pelayo@fbe.demo', 'demo');
const despues = cifrasPiloto(res, hoyISO(), await apiD.encuestaEsencial(suyos.map((r) => r.atleta_id), TITULOS_ENCUESTA));
check(despues.encuesta.mandadas === 7 && despues.encuesta.contestadas === 1, 'Inés contesta: 1 de 7 contestadas, y Pelayo lee su respuesta');
check(sumarDias(hoy, 0) === hoy, '(fin)');

console.log('\nEl alta (097)');
{
  const H = '2027-01-14';   // (un jueves: la semana 1 de quien empezó el lunes 11)
  const r = (id, nombre, estado = 'activo', extra = {}) => ({ atleta_id: id, nombre, estado, modalidad: 'por_su_cuenta', alertas: [], ...extra });
  const res = [r('a', 'Ana'), r('b', 'Berta'), r('c', 'Carmen', 'invitado'), r('d', 'Dani', 'invitado'), r('e', 'Eva', 'baja'), { atleta_id: 'x', nombre: 'Xus', estado: 'activo', modalidad: 'seguimiento', alertas: [] }];
  const altas = [
    { atleta_id: 'a', inicio: '2027-01-11', invitado_en: '2026-12-15T10:00:00Z', activado_en: '2026-12-16T10:00:00Z', push: true, email: false, cuestionario_en: '2026-12-20T10:00:00Z', resultado: 'sin_valoracion', plan_inicio: '2027-01-11', primera_sesion: '2027-01-12' },
    { atleta_id: 'b', inicio: '2027-01-11', invitado_en: '2026-12-15T10:00:00Z', activado_en: '2026-12-18T10:00:00Z', push: false, email: false, cuestionario_en: '2026-12-21T10:00:00Z', resultado: 'valorar_antes', visto_bueno_pedido_en: '2027-01-09T10:00:00Z', plan_inicio: null, primera_sesion: null },
    { atleta_id: 'c', inicio: '2027-01-18', invitado_en: '2026-12-20T10:00:00Z', caduca_en: '2027-01-25T10:00:00Z' },
    { atleta_id: 'd', inicio: '2027-02-15', invitado_en: '2026-12-20T10:00:00Z', caduca_en: '2027-01-03T10:00:00Z' },
    { atleta_id: 'e', inicio: '2027-01-11', invitado_en: '2026-12-15T10:00:00Z', activado_en: '2026-12-16T10:00:00Z' },
  ];
  const e = embudoAlta(altas, res);
  check(e.pasos.map((x) => `${x.nombre} ${x.n}`).join(', ') === 'Invitados 4, Cuenta activa 2, Cuestionario 2, Con plan 1, Primera sesión 1', `el embudo, sin los de baja ni los de seguimiento (${e.pasos.map((x) => x.n).join(' → ')})`);
  check(e.porConfirmar.length === 1 && e.porConfirmar[0].nombre === 'Berta' && e.sinAvisos.join() === 'Berta' && e.mediana === 28, 'el visto bueno de Berta por confirmar; Berta, sin ningún aviso; la mitad tarda 28 días o menos de la invitación a su primera sesión');
  const s = sinActivarAlta(altas, res, H);
  check(s.map((x) => x.nombre).join() === 'Carmen,Dani' && s[0].urgente && s[0].faltan === 4 && !s[0].caducado && !s[1].urgente && s[1].caducado, 'sin activar: Carmen primero (empieza en 4 días: urgente) y Dani (empieza en febrero; su código ya no vale)');
  check(sinActivarAlta(null, res, H).map((x) => x.nombre).join() === 'Carmen,Dani', 'sin la 097, al menos los nombres');
  check(avisosDe(altas[0]) === 'Avisos en el móvil' && avisosDe({ email: true }) === 'Avisos por correo' && avisosDe(altas[1]) === 'Sin avisos' && avisosDe(null) === null, 'sus avisos, en palabras');
  const sin1 = { plan_inicio: '2027-01-11', primera_sesion: null };
  check(semana1SinEmpezar(sin1, { ultimaSesion: null }, H) && !semana1SinEmpezar(sin1, { ultimaSesion: null }, '2027-01-13') && !semana1SinEmpezar(sin1, { ultimaSesion: '2027-01-12' }, H) && !semana1SinEmpezar(sin1, { ultimaSesion: null }, '2027-01-18'),
    'su semana 1 sin empezar: desde el jueves y hasta el domingo, si no ha hecho ninguna sesión');
  const f = filaPiloto({ ...r('z', 'Zoe'), bloque: { nombre: 'Primeras 4 semanas' }, semana: { numero: 1 } }, H, sin1);
  check(f.nivel === 'ambar' && f.avisos[0] === 'Semana 1 sin empezar' && f.notificaciones === 'Sin avisos', 'en su fila: ámbar, «Semana 1 sin empezar» y sus avisos');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
