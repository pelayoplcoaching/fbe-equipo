// (v0.260, la constancia: C1 a C11) Los tres niveles, la vuelta tras un parón con la escala de Pelayo, el plan mínimo, el plan
// B, la semana 6, antes de la baja y la lista por riesgo del panel. Todo apagado hasta el visto bueno de Pelayo.
import { readFileSync } from 'node:fs';
import * as C from '../web/src/logica/constancia.js';
import { APAGADO, encendido } from '../web/src/logica/esencial-respuestas.js';
import { REVISAR_POR, revisarCompleto } from '../web/src/logica/esencial-ajustes.js';
import { NOTA_CONSERVAR } from '../web/src/logica/esencial-motor.js';
import { explicar } from '../web/src/logica/esencial-porque.js';
import { sumarDias, lunesDe } from '../web/src/logica/fechas.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const lee = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8');

// Un jueves cualquiera; su semana empieza el lunes 1 de febrero de 2027
const hoy = '2027-02-04';
const l1 = lunesDe(hoy), l0 = sumarDias(l1, -7), lm1 = sumarDias(l1, -14), lm2 = sumarDias(l1, -21);
const w = (id, lunes, cierre = null) => ({ id, fecha_inicio: lunes, esencial_cierre: cierre });
const s = (id, dia, completada = false, fecha = null) => ({ id, dia_previsto: dia, completada, fecha_realizada: fecha });

console.log('C1: dos sesiones seguidas sin hacer (nivel 1)');
{
  const ss = [s('a', sumarDias(l1, 0)), s('b', sumarDias(l1, 2)), s('c', sumarDias(l1, 4))];
  check(C.faltadasSeguidas({ hoy, sesiones: ss }).n === 2 && C.faltadasSeguidas({ hoy, sesiones: ss }).desde === l1, 'lunes y miércoles sin hacer (el viernes aún no ha llegado): dos seguidas, desde el lunes');
  check(C.faltadasSeguidas({ hoy, sesiones: [s('a', l1), s('b', sumarDias(l1, 2), true, sumarDias(l1, 2))] }).n === 0, 'si hizo la última, nada');
  check(C.faltadasSeguidas({ hoy, sesiones: [s('a', l1), s('b', sumarDias(l1, 2)), s('x', null, true, sumarDias(l1, 3))] }).n === 0, 'si hizo otra después (otro día), no se le han pasado');
  check(C.faltadasSeguidas({ hoy, sesiones: [s('a', hoy), s('b', sumarDias(l1, 2))] }).n === 1, 'la de hoy no cuenta todavía');
}

console.log('\nC1: dos semanas flojas (nivel 2) y diez días (nivel 3)');
const semanas = [w('m2', lm2), w('m1', lm1), w('w0', l0), w('w1', l1)];
const floja = (k) => [s(`${k}1`, null, true, sumarDias(l0, 1)), s(`${k}2`, null), s(`${k}3`, null)];
const bien = (k, lunes) => [s(`${k}1`, null, true, sumarDias(lunes, 1)), s(`${k}2`, null, true, sumarDias(lunes, 3))];
{
  const ses = { m2: bien('m2', lm2), m1: floja('m1'), w0: floja('w0'), w1: [s('w11', sumarDias(l1, 1))] };
  const fl = C.semanasFlojas({ actual: semanas[3], semanas, sesiones: ses });
  check(fl.n === 2 && fl.hechas === 2 && fl.total === 6, `dos semanas seguidas con menos de la mitad (${fl.hechas} de ${fl.total})`);
  check(C.semanasFlojas({ actual: semanas[3], semanas: [w('m2', lm2), w('m1', lm1, 'pausa'), w('w0', l0), w('w1', l1)], sesiones: ses }).n === 1, 'una semana en pausa corta la cuenta');
  const hechas = [{ fecha: sumarDias(l0, 1) }];
  const nv = C.nivelConstancia({ hoy, actual: semanas[3], semanas, sesiones: ses, hechas, inicio: lm2 });
  check(nv.nivel === 2 && /Dos semanas seguidas/.test(nv.motivo), `nivel 2 («${nv.motivo}»)`);
  const nv3 = C.nivelConstancia({ hoy, actual: semanas[3], semanas, sesiones: ses, hechas: [{ fecha: sumarDias(hoy, -10) }], inicio: lm2 });
  check(nv3.nivel === 3 && nv3.dias === 10, 'diez días sin entrenar: nivel 3 (manda sobre las semanas flojas)');
  check(C.nivelConstancia({ hoy, actual: { ...semanas[3], esencial_cierre: 'pausa' }, semanas, sesiones: ses, hechas: [], inicio: lm2 }).nivel === 0, 'en una semana en pausa, nada');
  check(C.nivelConstancia({ hoy, actual: semanas[3], semanas, sesiones: ses, hechas: [], inicio: lm2, deViaje: true }).nivel === 0, 'de viaje, nada');
  check(C.nivelConstancia({ hoy, actual: semanas[3], semanas, sesiones: ses, hechas: [], inicio: sumarDias(hoy, 4) }).nivel === 0, 'antes de su lunes, nada');
  const n1 = C.nivelConstancia({ hoy, actual: semanas[3], semanas, sesiones: { w0: bien('w0', l0), w1: [s('a', l1), s('b', sumarDias(l1, 2))] }, hechas: [{ fecha: sumarDias(l0, 3) }], inicio: lm2 });
  check(n1.nivel === 1 && n1.faltadas === 2 && n1.dias === 7, `dos de esta semana sin hacer: nivel 1 (${n1.motivo})`);
  const t = C.textoNivel1({ faltadas: 2, planB: { hora: 'tarde', b: 'siguiente' } });
  check(t.titulo === 'Se te han pasado dos sesiones' && /nada que recuperar/.test(t.texto) && /Tu plan B: si un día no puedes, la haces al día siguiente/.test(t.texto), 'su texto, con su plan B');
  check(!/plan B/.test(C.textoNivel1({ faltadas: 2 }).texto), 'sin plan B, sin esa frase');
}

console.log('\nC2: la vuelta tras un parón, con la escala de Pelayo');
{
  check(C.PARON_ESENCIAL === 14 && C.VUELTA_ESENCIAL[0].desde === 14 && C.VUELTA_ESENCIAL[0].kgPct === 10 && C.VUELTA_ESENCIAL[0].series === 1
    && C.VUELTA_ESENCIAL[1].desde === 29 && C.VUELTA_ESENCIAL[1].kgPct === 20, 'menos de 2 semanas, igual; de 2 a 4, una serie menos y −10 %; más de 4, −20 %');
  const r = C.reglasVueltaEsencial({ fbe: { x: 1 } });
  check(r.atleta.frenos.paron === 14 && r.atleta.vuelta === C.VUELTA_ESENCIAL && r.fbe.x === 1, 'se le pasa al motor como sus reglas (las de FBE, intactas)');
  const suya = C.reglasVueltaEsencial({ atleta: { vuelta: [{ desde: 7, kgPct: 5, series: 0 }], frenos: { paron: 7 } } });
  check(suya.atleta.vuelta[0].desde === 7 && suya.atleta.frenos.paron === 7, 'si Pelayo ya le había puesto la suya, se respeta');
  const d = { sesiones: { a: [{ completada: true, fecha_realizada: '2027-01-01' }], b: [{ completada: true, fecha_realizada: '2027-02-03' }] } };
  check(C.segundaSemanaVuelta({ d, base: { id: 'b', fecha_inicio: '2027-02-01' } })?.dias === 33, 'tras 33 días parado, la semana de vuelta: la siguiente, también de vuelta');
  const d2 = { sesiones: { a: [{ completada: true, fecha_realizada: '2027-01-20' }], b: [{ completada: true, fecha_realizada: '2027-02-03' }] } };
  check(C.segundaSemanaVuelta({ d: d2, base: { id: 'b', fecha_inicio: '2027-02-01' } }) === null, 'con 14 días, una sola semana de vuelta');
  check(/Segunda semana de tu vuelta/.test(NOTA_CONSERVAR.vuelta2) && explicar({ frenos: ['vuelta_dos'], tipo: 'mantener', semana: 'normal', antes: { kg: 50 }, despues: { kg: 50 } })?.corto === 'Vuelta, segunda semana',
    'la segunda semana repite la carga, con su nota y su porqué');
  const m = lee('web/src/logica/esencial-motor.js');
  check(/if \(extras\?\.vueltaEsencial\) suyas = \{ \.\.\.suyas, reglas: reglasVueltaEsencial/.test(m) && /segundaSemanaVuelta\(\{ d, base \}\) \? 'vuelta2'/.test(m), 'en el motor de FBE Esencial, solo con la clave');
}

console.log('\nC3: el plan mínimo');
{
  const f = C.fechasPlanMinimo(hoy);
  check(f.desde === l1 && f.hasta === sumarDias(l1, 13), 'del lunes de esta semana al domingo de la siguiente');
  const notas = [{ tipo: 'plan_minimo', desde: l1, hasta: sumarDias(l1, 13) }];
  check(C.planMinimoDe({ notas, hoy })?.semana === 1 && C.planMinimoDe({ notas, hoy: sumarDias(l1, 8) })?.semana === 2 && C.planMinimoDe({ notas, hoy: sumarDias(l1, 14) }) === null,
    'semana 1, semana 2 y, a las dos semanas, vuelve su plan');
  const pautas = [
    { id: 'p', series: 3, prioridad: 'alta', ejercicio: { nombre: 'Prensa de piernas', tipo: ['multiarticular'] } },
    { id: 'c', series: 3, prioridad: 'media', ejercicio: { nombre: 'Curl femoral', tipo: ['aislamiento'] } },
    { id: 'b', series: 3, prioridad: 'media', ejercicio: { nombre: 'Press de pecho', tipo: ['multiarticular'] } },
  ];
  const pr = C.propuestaPlanMinimo(pautas);
  check(pr?.tipo === 'minima' && pr.ids.join() === 'p,b' && /Tu plan mínimo: lo principal \(prensa de piernas, press de pecho\), con 2 series/.test(pr.texto), 'en la sesión: lo principal, con 2 series');
  const ses = lee('web/src/ui/atleta/Sesion.jsx');
  check(/aplicarPropuesta\(enOrdenHoy, propPm \|\| propDia, hechas\)/.test(ses) && /encendido\('plan_minimo', previaDemo\)/.test(ses), 'la sesión lo aplica (con «Entrenar normal» ese día), con la clave');
}

console.log('\nC5, C7 y C9');
{
  check(C.planBValido({ hora: 'tarde', b: 'minima' }) && !C.planBValido({ hora: 'madrugada', b: 'minima' }) && C.horaDelPlan({ hora: 'manana', b: 'finde' }) === 9, 'el plan B: su hora y qué hace si un día no puede');
  const ses = { m1: bien('m1', lm1), w0: [s('a', null, true, l0), s('b', null)], w1: [] };
  const r6 = C.revisionSemana6({ n: 6, semanas: [w('m1', lm1), w('w0', l0), w('w1', l1)], sesiones: ses, actual: w('w1', l1) });
  check(r6 && r6.hechas === 3 && r6.total === 4 && r6.completas === 1 && C.revisionSemana6({ n: 5, semanas: [], sesiones: {}, actual: w('w1', l1) }) === null, 'la semana 6: cuántas sesiones y semanas completas lleva (solo en la 6)');
  check(C.riesgoBaja({ flojas: 3 })?.por === 'flojas' && C.riesgoBaja({ flojas: 2, comoVamos: [{ datos: { nota: 4 }, creada_en: 'x' }] })?.por === 'nota' && C.riesgoBaja({ flojas: 2, comoVamos: [{ datos: { nota: 7 } }] }) === null,
    'antes de la baja: tres semanas flojas o un «¿Cómo vamos?» de 5 o menos');
  check(C.OPCIONES_ANTES_BAJA.map((x) => x[0]).join() === 'pausa,minimo,rutina', 'con una pausa, el plan mínimo o una rutina que encaje mejor');
}

console.log('\nC11: el panel, por riesgo');
{
  const r = (nombre, extra) => ({ atleta_id: nombre, nombre, estado: 'activo', ...extra });
  const filas = [
    { ...r('Bea', { modalidad: 'seguimiento', alertas: [{ tipo: 'cumplimiento', texto: 'Cumplimiento bajo: 60 %' }] }), ...C.nivelDeResumen(r('Bea', { alertas: [{ tipo: 'cumplimiento', texto: 'Cumplimiento bajo: 60 %' }] }), hoy) },
    { ...r('Ana', { modalidad: 'por_su_cuenta' }), ...C.nivelDeResumen(r('Ana', { ultimaSesion: sumarDias(hoy, -12) }), hoy) },
    { ...r('Cris', { modalidad: 'seguimiento' }), ...C.nivelDeResumen(r('Cris', { alertas: [{ tipo: 'sin_entrenar', texto: '6 días sin registrar' }] }), hoy) },
    { ...r('Dani', { modalidad: 'por_su_cuenta' }), ...C.nivelDeResumen(r('Dani', { ultimaSesion: sumarDias(hoy, -2) }), hoy, { flojas: 2 }) },
    { ...r('Eva', { modalidad: 'seguimiento' }), ...C.nivelDeResumen(r('Eva', { ultimaSerie: hoy }), hoy) },
  ];
  const o = C.ordenRiesgo(filas);
  check(o.map((x) => `${x.nombre}${x.nivel}`).join() === 'Ana3,Bea2,Dani2,Cris1', `de más a menos riesgo, sin quien va bien (${o.map((x) => x.nombre).join(', ')})`);
  check(C.nivelDeResumen({ servicio: 'nutricion', ultimaSerie: sumarDias(hoy, -30) }, hoy).nivel === 0, 'quien solo lleva nutrición no sale');
  const p = lee('web/src/ui/coach/EsencialPanel.jsx');
  check(/<ConstanciaRiesgo lista=\{lista\}/.test(p), 'en tu panel, con tus dos grupos');
}

console.log('\nApagado');
{
  const claves = ['constancia_aviso', 'vuelta_esencial', 'plan_minimo', 'avisos_constancia', 'plan_b', 'revision_6', 'antes_baja'];
  check(claves.every((k) => APAGADO.has(k) && !encendido(k) && encendido(k, true) && REVISAR_POR[k]) && revisarCompleto(), 'las siete, apagadas hasta el visto bueno de Pelayo (en «Por revisar»)');
  const sql = lee('supabase/migraciones/111_constancia.sql');
  check(/clave = 'avisos_constancia' and \(x\.encendido or x\.solo_atleta = d\.atleta_id\)/.test(sql), 'los avisos del móvil, solo con «Los avisos de constancia» encendido (o probándolo en una cuenta)');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
