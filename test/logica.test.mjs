// Lógica pura: fechas, 1RM estimado, propuestas de series, avisos del coach y la cola sin conexión.
import { lunesDe, sumarDias, diasEntre, hace, rangoSemana } from '../web/src/logica/fechas.js';
import { conDefecto, preferenciasValidas, claveServidor, normalizarB64url, describirDispositivo, soportePush, esIos, momentoNotificacion, PREFERENCIAS_DEFECTO, TIPOS_ATLETA, TIPOS_COACH } from '../web/src/logica/notificaciones.js';
import { resultadoCribado, avisoCuestionario, resumenCuestionario, limpiarCuestionario, pasosHechos, MENSAJE_ATLETA, RESULTADO_COACH, SINTOMAS, OTRAS, objetivosDe, textoObjetivos } from '../web/src/logica/cuestionario.js';
import { pregunta, preguntasDe, respuestaValida, limpiarRespuestas, respuestasNoValidas, textoRespuesta, serieRespuestas } from '../web/src/logica/preguntas.js';
import { grados, dibujoValido, limpiarDibujo, rectImagen, describirDibujo } from '../web/src/logica/dibujo.js';
import { tuDia, resumenDia } from '../web/src/logica/dia.js';
import { progresarPauta, opcionesDe } from '../web/src/logica/progresion.js';
import { sumarMeses, finPeriodo, importePeriodo, siguientePeriodo, resumenCobros, cobradoEnMes, fmtEuros, leerEuros } from '../web/src/logica/cobros.js';
import { modoCarga, columnasEditor, pesoAnterior, conNutricion, textoServicio, NIVELES } from '../web/src/logica/nivel.js';
import { cardioValido, cardioHechoValido, limpiarCardio, limpiarCardioHecho, textoCardio, textoCardioHecho, ritmo, palabrasEsfuerzo, cardioPorSemana, cardioHechoDe } from '../web/src/logica/cardio.js';
import { valeParaDia, textoVariante, tomasDelDia, paraElDia, leerIngrediente, leerIngredientes, escalarCantidad, textoIngrediente, ingredientesATexto, limpiarReceta, avisoMacros, macrosDe, textoMacros, recetarioPorToma, entradaMenu, cambiarRaciones, totalesDia, menuPorDia, copiarMenu, listaCompra, textoListaCompra, tomasDe, ordenarTomas, TOMAS_DEFECTO } from '../web/src/logica/comidas.js';
import { conEntrenamiento, servicioDe, CAMPOS_SERVICIO } from '../web/src/logica/nivel.js';
import { e1rm, e1rmPorSemana, seriesPorGrupo, pauta, propuestaSerie, semanaActual, resumenAtleta, num, signo, mmss } from '../web/src/logica/calculos.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('Fechas');
check(lunesDe('2026-10-24') === '2026-10-19', 'el lunes de un sábado');
check(lunesDe('2026-10-19') === '2026-10-19', 'el lunes de un lunes');
check(lunesDe('2026-11-01') === '2026-10-26', 'el lunes de un domingo');
check(sumarDias('2026-10-30', 3) === '2026-11-02', 'sumar días cambia de mes');
check(sumarDias('2026-03-28', 2) === '2026-03-30', 'cruza el cambio de hora sin perder un día');
check(diasEntre('2026-10-19', '2026-10-24') === 5, 'días entre fechas');
check(hace('2026-10-23', '2026-10-24') === 'ayer' && hace('2026-10-01', '2026-10-24') === 'hace 3 semanas', 'texto relativo');
check(rangoSemana('2026-10-26') === '26 oct – 1 nov' && rangoSemana('2026-10-19') === '19–25 oct', 'rango de la semana');

console.log('\nFormato');
check(num(62.5, 2) === '62,5' && num(60) === '60' && num(null) === '—', 'números con coma decimal');
check(signo(-0.4) === '−0,4' && signo(0) === '±0' && signo(1.25, 2) === '+1,25', 'signo con menos tipográfico');
check(mmss(150) === '2:30' && mmss(59.6) === '1:00', 'minutos y segundos');

console.log('\n1RM estimado');
check(e1rm({ kg: 100, reps: 5, rpe: 8 }) === 123.3, '100 × 5 @8 → 123,3 (Epley con 2 en recámara)');
check(e1rm({ kg: 100, reps: 5, rir: 0 }) === 116.7, '100 × 5 al fallo → 116,7');
check(e1rm({ kg: 100, reps: 5 }) === 116.7, 'sin RPE ni RIR cuenta como al fallo');
check(e1rm({ kg: 100, reps: 15 }) === null && e1rm({ kg: 0, reps: 5 }) === null, 'no estima con más de 12 repeticiones o sin carga');
const ps = e1rmPorSemana([
  { kg: 60, reps: 8, rpe: 8, fecha: '2026-10-05' }, { kg: 62.5, reps: 8, rpe: 9, fecha: '2026-10-07' }, { kg: 65, reps: 6, rpe: 9, fecha: '2026-10-14' },
]);
check(ps.length === 2 && ps[0].valor === 81.3 && ps[1].semana === '2026-10-12', 'mejor e1RM de cada semana');

console.log('\nVolumen');
const vol = seriesPorGrupo([
  { fecha: '2026-10-20', reps: 8, grupos: ['pectoral', 'triceps', 'deltoides'] },
  { fecha: '2026-10-21', reps: 8, grupos: ['pectoral', 'triceps', 'deltoides'] },
  { fecha: '2026-10-21', reps: 0, grupos: ['pectoral'] },
  { fecha: '2026-10-27', reps: 8, grupos: ['pectoral'] },
], '2026-10-19');
check(igual(vol, { pectoral: 2, triceps: 1, deltoides: 1 }), 'principal cuenta 1, secundarios 0,5; ignora series vacías y de otra semana');

console.log('\nPrescripción');
const se = { series: 3, reps_min: 6, reps_max: 8, rir_objetivo: 2, carga_sugerida_kg: 60, descanso_seg: 150 };
check(igual(pauta(se), { series: '3 × 6–8', top: false, esfuerzo: 'RIR 2', carga: '60 kg', descanso: '2:30' }), 'texto de la pauta');
check(pauta({ series: 4, reps_min: 5, reps_max: 5, rpe_objetivo: 8 }).series === '4 × 5', 'rango de una sola cifra');
check(igual(propuestaSerie(se, null, 1), { kg: 60, reps: 8 }), 'sin historial propone lo pautado');
check(igual(propuestaSerie(se, [{ numero: 1, kg: 62.5, reps: 7 }, { numero: 2, kg: 62.5, reps: 6 }], 2), { kg: 62.5, reps: 8 }), 'si el atleta ya superó la carga pautada, propone la suya');
check(igual(propuestaSerie({ ...se, carga_sugerida_kg: 95 }, [{ numero: 1, kg: 92.5, reps: 8 }], 1), { kg: 95, reps: 8 }), 'si el coach progresó la carga, propone la nueva');

const C = await import('../web/src/logica/calculos.js');
check(C.e1rm({ kg: 100, reps: 1, rpe: 10 }) === 100 && C.e1rm({ kg: 100, reps: 1, rpe: 9 }) === 106.7, '1 repetición al fallo es el propio 1RM; con 1 en recámara, Epley');
check(C.kgPara(123.3, 5, 2) === 100 && C.kgPara(100, 1, 0) === 100, 'la carga para unas repeticiones y RIR es la inversa del 1RM estimado');
const tabla = C.tablaRpe(100);
check(tabla.length === 10 && tabla[0].cargas[0].kg === 100 && tabla[4].cargas.find((x) => x.rpe === 8).kg === 80, 'tabla de cargas por repeticiones y RPE (5 @8 con 1RM de 100 → 80)');

console.log('\nDoble progresión');
const pr8 = { series: 3, reps_min: 6, reps_max: 8, rir_objetivo: 2, carga_sugerida_kg: 60 };
const tope = [{ numero: 1, kg: 60, reps: 8, rpe: 8 }, { numero: 2, kg: 60, reps: 8, rpe: 8 }, { numero: 3, kg: 60, reps: 8, rpe: 8.5 }];
const sub = C.sugerenciaProgresion(pr8, tope, { nombre: 'Press banca' });
check(sub.tipo === 'subir' && sub.kg === 62.5, 'tope del rango en las 3 series a RPE 8 (RIR 2) → subir 2,5 kg en barra');
check(C.sugerenciaProgresion(pr8, tope.map((s) => ({ ...s, rpe: 9.5 })), { nombre: 'Press banca' }).tipo === 'repetir', 'si llegó al tope pasándose de esfuerzo (RPE 9,5), no sube');
check(C.sugerenciaProgresion(pr8, tope.slice(0, 2), { nombre: 'Press banca' }).tipo === 'repetir', 'si hizo menos series de las pautadas, no sube');
check(C.sugerenciaProgresion(pr8, [{ numero: 1, kg: 60, reps: 8 }, { numero: 2, kg: 60, reps: 7 }, { numero: 3, kg: 60, reps: 5 }], { nombre: 'Press banca' }).tipo === 'mantener', 'por debajo del mínimo → mantener');
check(C.sugerenciaProgresion(pr8, tope, { nombre: 'Press inclinado con mancuernas' }).kg === 62, 'en mancuernas sube 2 kg');
check(C.sugerenciaProgresion(pr8, tope, { foco: 'descarga' }) === null, 'en semana de descarga no sugiere');
check(C.sugerenciaProgresion({ ...pr8, carga_sugerida_kg: 50 }, tope, { pautaAnterior: { carga_sugerida_kg: 60 } }) === null, 'si el coach ha bajado la carga, no sugiere');
check(igual(C.propuestaSerie(pr8, tope, 1, { sugerencia: sub }), { kg: 62.5, reps: 8 }), 'la propuesta usa la carga sugerida');
check(igual(C.propuestaSerie({ ...pr8, carga_sugerida_kg: 50 }, tope, 1, { pautaAnterior: { carga_sugerida_kg: 60 } }), { kg: 50, reps: 8 }), 'en una descarga del coach manda la pauta, aunque la última vez moviera más');

console.log('\nAproximaciones');
const ap = C.aproximaciones(100, 5);
check(igual(ap.map((x) => [x.kg, x.reps]), [[20, 10], [40, 5], [60, 3], [75, 2], [85, 1]]), 'hacia 100 × 5: barra, 40, 60, 75 y 85 kg');
check(igual(ap[2].discos, [20]), 'con los discos por lado de cada una');
check(igual(C.aproximaciones(60, 10).map((x) => x.kg), [20, 30, 42.5]), 'con series de 10 no hace la de 1 repetición');
check(igual(C.aproximaciones(30, 10, { barra: 0, paso: 2 }).map((x) => x.kg), [16, 22]), 'en mancuernas: 50 % y 75 %');
check(C.aproximaciones(25, 8).length === 0, 'si la carga es casi la barra, no hay aproximaciones');

console.log('\nHistorial de un ejercicio');
const hist = C.resumenEjercicio([
  { fecha: '2026-10-05', sesion_id: 'a', numero: 1, kg: 60, reps: 8, rpe: 8 }, { fecha: '2026-10-05', sesion_id: 'a', numero: 2, kg: 60, reps: 7, rpe: 9 },
  { fecha: '2026-10-12', sesion_id: 'b', numero: 1, kg: 62.5, reps: 8, rpe: 8 },
  { fecha: '2026-10-19', sesion_id: 'c', numero: 1, kg: 62.5, reps: 6, rpe: 9 },
]);
check(hist.sesiones.length === 3 && hist.sesiones[0].fecha === '2026-10-19', 'sesiones de la más reciente a la más antigua');
check(hist.sesiones.find((s) => s.sesion_id === 'b').record && !hist.sesiones.find((s) => s.sesion_id === 'c').record, 'marca la sesión con récord de 1RM estimado');
check(hist.mejor.valor === 83.3 && hist.porReps[8].kg === 62.5 && hist.sesiones[2].volumen === 900, 'mejor 1RM, récords por repeticiones y volumen');
const csv = C.seriesACsv([{ fecha: '2026-10-05', ejercicio: 'Press banca', numero: 1, kg: 62.5, reps: 8, rpe: 8.5, nota: 'bien; fácil' }]);
check(csv.startsWith('﻿Fecha;Ejercicio') && csv.includes('2026-10-05;Press banca;1;62,5;8;8,5;;82,3;;"bien; fácil"'), 'CSV para Excel en español');

console.log('\nSuperseries');
const ses = [
  { id: 'p', series: 3, superserie: null, descanso_seg: 150 },
  { id: 'a1', series: 3, superserie: 'A', descanso_seg: 60 },
  { id: 'a2', series: 2, superserie: 'A', descanso_seg: 90 },
  { id: 'b', series: 2, superserie: 'B', descanso_seg: 60 },
  { id: 'q', series: 2, superserie: null, descanso_seg: null },
];
const gss = C.gruposSuperserie(ses);
check(gss.length === 4 && gss[1].letra === 'A' && gss[1].items.length === 2 && gss[2].letra === null, 'agrupa los seguidos con la misma letra; una letra sola no es superserie');
check(igual(C.etiquetasSuperserie(ses), { a1: 'A1', a2: 'A2' }), 'etiquetas A1, A2');
const tras = (h, id) => C.trasSerie(ses, h, id);
check(igual(tras({ a1: 1 }, 'a1'), { descanso: 0, siguiente: { id: 'a2', numero: 1 }, enRonda: true }), 'tras A1 se pasa a A2 sin descanso');
check(igual(tras({ a1: 1, a2: 1 }, 'a2'), { descanso: 90, siguiente: { id: 'a1', numero: 2 }, enRonda: false }), 'al cerrar la ronda, el descanso mayor del grupo y vuelta a A1');
check(igual(tras({ a1: 1, a2: 1 }, 'a1'), { descanso: 90, siguiente: { id: 'a1', numero: 2 }, enRonda: false }), 'en orden inverso (A2 y luego A1) también cierra la ronda');
check(tras({ a2: 1 }, 'a2').siguiente.id === 'a1' && tras({ a2: 1 }, 'a2').descanso === 0, 'si empieza por A2, sigue A1 sin descanso');
check(igual(tras({ a1: 3, a2: 2 }, 'a1'), { descanso: 90, siguiente: { id: 'b', numero: 1 }, enRonda: false }), 'con menos series en A2, la última ronda es solo A1 y luego el siguiente ejercicio');
check(igual(tras({ p: 1 }, 'p'), { descanso: 150, siguiente: { id: 'p', numero: 2 }, enRonda: false }), 'un ejercicio normal descansa lo suyo');
check(igual(tras({ p: 3 }, 'p'), { descanso: 150, siguiente: { id: 'a1', numero: 1 }, enRonda: false }), 'al acabarlo, pasa al siguiente pendiente');
check(igual(tras({ p: 3, a1: 3, a2: 2, b: 2, q: 2 }, 'q'), { descanso: null, siguiente: null, enRonda: false }), 'sin descanso pautado ni nada pendiente: fin');
check(igual(tras({ p: 1, a1: 3, a2: 2, b: 2, q: 2 }, 'q').siguiente, { id: 'p', numero: 2 }), 'si queda algo de antes, vuelve a ello');

console.log('\nRécords');
const hist0 = [
  { id: 'h1', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-01', sesion_id: 's1', kg: 60, reps: 8, rpe: 8 },
  { id: 'h2', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-01', sesion_id: 's1', kg: 70, reps: 3, rpe: 8 },
  { id: 'h3', ejercicio_id: 'dom', ejercicio: 'Dominadas', fecha: '2026-10-01', sesion_id: 's1', kg: 0, reps: 8 },
];
const prev = C.mejoresMarcas(hist0);
check(prev.banca.e1rm.kg === 70 && prev.banca.kgPorReps[3].kg === 70 && prev.banca.kgPorReps[8].kg === 60 && prev.dom.repsSinCarga === 8, 'mejores marcas: 1RM estimado, carga por repeticiones y repeticiones sin carga');
check(C.recordDe({ kg: 62.5, reps: 8, rpe: 8 }, prev.banca)?.tipo === 'e1rm', 'más 1RM estimado: récord');
check(C.recordDe({ kg: 72.5, reps: 3, rpe: 10 }, prev.banca)?.tipo === 'kg', 'más carga a 3 repeticiones aunque el 1RM estimado no suba: récord de repeticiones');
check(C.recordDe({ kg: 60, reps: 8, rpe: 8 }, prev.banca) === null && C.recordDe({ kg: 60, reps: 5, rpe: 9 }, prev.banca) === null, 'igualar o quedarse por debajo no es récord');
check(C.recordDe({ kg: 62.5, reps: 8 }, prev.banca)?.tipo === 'kg', 'sin RPE no se compara el 1RM estimado (saldría inflado), pero sí la carga a esas repeticiones');
check(C.recordDe({ kg: 0, reps: 10 }, prev.dom)?.tipo === 'reps' && C.recordDe({ kg: 100, reps: 5 }, null) === null, 'sin carga cuentan las repeticiones; sin historial no hay récord');
const hoyRec = C.recordsDeSesion([
  { id: 'a', ejercicio_id: 'banca', kg: 62.5, reps: 8, rpe: 8 },
  { id: 'b', ejercicio_id: 'banca', kg: 62.5, reps: 8, rpe: 8 },
  { id: 'c', ejercicio_id: 'nuevo', kg: 40, reps: 10, rpe: 8 },
  { id: 'd', ejercicio_id: 'nuevo', kg: 45, reps: 10, rpe: 8 },
], prev);
check(igual(Object.keys(hoyRec), ['a']), 'en la sesión: la segunda serie igual ya no es récord y un ejercicio nuevo no da récords');
const vit = C.vitrina([...hist0, { id: 'h4', ejercicio_id: 'banca', ejercicio: 'Press banca', fecha: '2026-10-20', sesion_id: 's2', kg: 65, reps: 8, rpe: 8 }], '2026-10-24');
check(vit.ejercicios[0].nombre === 'Press banca' && vit.ejercicios[0].ultimoRecord === '2026-10-20' && vit.recientes.length === 1 && vit.recientes[0].record.tipo === 'e1rm', 'vitrina: mejor marca por ejercicio y récords recientes');

console.log('\nConstancia');
const sem = (f, total, hechas) => ({ fecha_inicio: f, total, hechas });
check(C.racha([sem('2026-10-05', 4, 4), sem('2026-10-12', 4, 4), sem('2026-10-19', 4, 1)], '2026-10-24') === 2, 'racha: dos semanas completas; la actual a medias no la rompe');
check(C.racha([sem('2026-10-05', 4, 4), sem('2026-10-12', 4, 3), sem('2026-10-19', 4, 4)], '2026-10-24') === 1, 'una semana incompleta la corta; la actual completa suma');
check(C.racha([sem('2026-09-21', 3, 3), sem('2026-10-12', 3, 3), sem('2026-10-19', 3, 0)], '2026-10-24') === 2, 'las semanas sin nada programado (entre bloques) no la rompen');
check(C.racha([sem('2026-10-12', 2, 1), sem('2026-10-12', 2, 2)], '2026-10-20') === 0 && C.racha([], '2026-10-24') === 0, 'dos bloques en la misma semana se suman; sin semanas, 0');
const mapa = C.mapaCalor({ '2026-10-20': 18, '2026-10-22': 6, '2026-10-01': 1 }, '2026-10-24', 12);
const celda = (iso) => mapa.flatMap((w) => w.dias).find((d) => d.iso === iso);
check(mapa.length === 12 && mapa[11].lunes === '2026-10-19' && mapa[0].lunes === '2026-08-03', 'mapa: 12 semanas de lunes a domingo hasta la actual');
check(celda('2026-10-20').nivel === 3 && celda('2026-10-22').nivel === 1 && celda('2026-10-21').nivel === 0 && celda('2026-10-25').nivel === -1, 'intensidad por series del día; los días que no han llegado, aparte');

console.log('\nVolumen objetivo');
check(igual(C.rangoVolumen(null, 'pectoral'), [10, 20]) && igual(C.rangoVolumen({ pectoral: [12, 18] }, 'pectoral'), [12, 18]) && igual(C.rangoVolumen({ pectoral: 'x' }, 'pectoral'), [10, 20]), 'rango por músculo: el del atleta o el general');
check(C.estadoVolumen(8, [10, 20]) === 'bajo' && C.estadoVolumen(10, [10, 20]) === 'dentro' && C.estadoVolumen(21.5, [10, 20]) === 'alto', 'por debajo, dentro o por encima');
check(igual(C.limpiarObjetivo({ pectoral: [12, 18], espalda: [10, 20], biceps: [8, 4], inventado: [1, 2] }), { pectoral: [12, 18] }) && C.limpiarObjetivo({ espalda: [10, 20] }) === null, 'solo se guarda lo que difiere del general y tiene sentido');
const pautasSem = [{ ejercicio_id: 'p', series: 4 }, { ejercicio_id: 'f', series: 3 }, { ejercicio_id: 'x', series: 2 }];
const ejsSem = { p: { grupos_musculares: ['pectoral', 'triceps'] }, f: { grupos_musculares: ['triceps', 'pectoral'] } };
check(igual(C.seriesPautadasPorGrupo(pautasSem, ejsSem), { pectoral: 5.5, triceps: 5 }), 'series pautadas por músculo en la semana');

console.log('\nPeso: tendencia y ritmo');
const pesosDiarios = Array.from({ length: 22 }, (_, i) => ({ fecha: sumarDias('2026-10-01', i), kg: 70 - i * 0.05 + (i % 2 ? 0.6 : -0.6) }));
const tend = C.tendenciaPeso(pesosDiarios);
const saltos = (k) => Math.max(...tend.slice(1).map((p, i) => Math.abs(p[k] - tend[i][k])));
check(tend.length === 22 && saltos('tendencia') < saltos('kg') / 5, 'la tendencia suaviza las oscilaciones del día a día');
const rit = C.ritmoPeso(tend);
check(rit && rit.kgSemana < -0.1 && rit.kgSemana > -0.6 && rit.pctSemana < 0, `ritmo de bajada en kg y % por semana (${rit?.kgSemana} kg)`);
check(C.ritmoPeso(C.tendenciaPeso([{ fecha: '2026-10-01', kg: 70 }, { fecha: '2026-10-03', kg: 69.8 }])) === null, 'con pocos pesos o menos de una semana no hay ritmo');
const conHueco = C.tendenciaPeso([{ fecha: '2026-10-01', kg: 70 }, { fecha: '2026-10-15', kg: 68 }]);
check(conHueco[1].tendencia < 69 && conHueco[1].tendencia > 68, 'tras días sin pesarse, el peso nuevo cuenta más');

console.log('\nPeso: cómo va, sin cifras');
const ep = (pct, fase, ritmo_pct) => C.estadoPeso(pct == null ? null : { kgSemana: pct * 0.7, pctSemana: pct, dias: 21 }, fase ? { fase, ritmo_pct } : null);
check(ep(null).sentido === null && ep(null).tono === 'neutro', 'sin una semana de pesos, todavía no dice hacia dónde va');
check(ep(-0.5, 'perder').tono === 'ok' && ep(-0.5, 'perder').titulo === 'Vas hacia tu objetivo', 'perdiendo grasa y bajando: va hacia su objetivo');
check(ep(-1.1, 'perder', -1).tono === 'ok', 'si el coach pautó un −1 % a la semana, bajar eso es ir bien (no «bajas rápido»)');
check(ep(-1.4, 'perder', -0.5).tono === 'aviso' && ep(-1.4, 'perder', -0.5).titulo === 'Bajas rápido', 'bajar un 1 % o más fuera de lo pautado: que lo comente con su coach');
check(ep(0.4, 'perder').tono === 'neutro' && ep(0.4, 'perder').sentido === 'sube', 'si sube un poco perdiendo grasa, sin alarmas: lo ven en el check-in');
check(ep(1.5, 'perder').tono === 'aviso' && ep(-1.5, 'mantener').tono === 'aviso', 'moverse rápido en el sentido contrario también avisa');
check(ep(0.1, 'mantener').tono === 'ok' && ep(0.1, 'mantener').sentido === 'estable', 'manteniendo, quedarse estable es ir bien');
check(ep(-0.25, 'recomposicion', -0.25).tono === 'ok', 'en recomposición a −0,25 %, bajar eso es ir bien');
check(ep(0.3, 'ganar').tono === 'ok' && ep(0.8, 'ganar', 0.25).tono === 'neutro' && ep(1.2, 'ganar', 0.25).tono === 'aviso', 'ganando: subir lo pautado va bien; algo más, a verlo; mucho más, a comentarlo');
check(ep(-0.5).tono === 'neutro' && ep(-0.5).titulo === 'Tu tendencia baja', 'sin plan de nutrición, solo describe la tendencia');
check(C.estadoPeso({ kgSemana: -0.3, pctSemana: -0.5, dias: 21 }, { fase: 'perder' }, 14).titulo === 'Hace días que no te pesas', 'si hace más de 10 días del último peso, no presume de tendencia');
check(['perder', 'mantener', 'ganar', 'recomposicion', null].every((f) => [-1.5, -0.5, 0, 0.5, 1].every((x) => !/\d/.test(ep(x, f).titulo + ep(x, f).detalle))), 'nunca enseña una cifra');

console.log('\nResumen semanal');
const serieS = (id, fecha, kg, reps, rpe, ej = 'banca', grupos = ['pectoral', 'triceps']) => ({ id, fecha, sesion_id: fecha, ejercicio_id: ej, ejercicio: ej === 'banca' ? 'Press banca' : 'Remo', grupos, kg, reps, rpe, registrada_en: `${fecha}T18:00:00Z` });
const dSem = {
  series: [serieS('a', '2026-10-06', 60, 8, 8), serieS('b', '2026-10-08', 50, 10, 8, 'remo', ['espalda', 'biceps']),
    serieS('c', '2026-10-13', 62.5, 8, 8), serieS('d', '2026-10-13', 62.5, 8, 8.5), serieS('e', '2026-10-15', 52.5, 10, 8, 'remo', ['espalda', 'biceps'])],
  sesiones: [{ semana_lunes: '2026-10-12', completada: true, fecha_realizada: '2026-10-13', duracion_min: 60 }, { semana_lunes: '2026-10-12', completada: true, fecha_realizada: '2026-10-15', duracion_min: 50 }, { semana_lunes: '2026-10-12', completada: false }],
  pesos: [{ fecha: '2026-10-05', kg: 70 }, { fecha: '2026-10-09', kg: 69.8 }, { fecha: '2026-10-11', kg: 69.9 }, { fecha: '2026-10-16', kg: 69.4 }, { fecha: '2026-10-18', kg: 69.3 }],
};
const rs = C.resumenSemanal(dSem, '2026-10-12');
check(rs.sesiones.hechas === 2 && rs.sesiones.total === 3 && rs.series === 3 && rs.minutos === 110, 'sesiones hechas de las programadas, series y minutos de la semana');
check(rs.tonelaje === 62.5 * 16 + 525 && rs.cambioTonelaje === Math.round(((1525 - 980) / 980) * 100), `tonelaje y cambio frente a la semana anterior (${rs.cambioTonelaje} %)`);
check(rs.records.length === 2 && rs.mejor.ejercicio === 'Press banca' && rs.musculoTop.grupo === 'pectoral', 'récords de la semana, mejor serie y músculo más trabajado');
check(rs.peso && rs.peso.cambio < 0 && !rs.vacia, `cambio de la tendencia de peso (${rs.peso?.cambio} kg)`);
check(C.resumenSemanal(dSem, '2026-09-28').vacia, 'una semana sin nada queda marcada como vacía');

console.log('\nDiscos');
const { discosPorLado, esBarra } = await import('../web/src/logica/calculos.js');
check(igual(discosPorLado(62.5), [20, 1.25]) && igual(discosPorLado(100), [25, 15]) && igual(discosPorLado(140), [25, 25, 10]), 'discos por lado con barra de 20');
check(igual(discosPorLado(20), []) && discosPorLado(17) === null && discosPorLado(21) === null, 'solo barra, menos que la barra, o carga imposible');
check(esBarra('Press banca') && esBarra('Sentadilla barra alta') && esBarra('Remo con barra') && !esBarra('Press inclinado con mancuernas') && !esBarra('Sentadilla en multipower') && !esBarra('Hip thrust en máquina'), 'distingue ejercicios con barra');

console.log('\nSemana actual');
const semanas = [{ id: 'a', numero: 1, fecha_inicio: '2026-10-05' }, { id: 'b', numero: 2, fecha_inicio: '2026-10-12' }, { id: 'c', numero: 3, fecha_inicio: '2026-10-19' }];
check(semanaActual(semanas, '2026-10-24').id === 'c', 'la que contiene hoy');
check(semanaActual(semanas, '2026-11-10').id === 'c', 'si ya pasaron todas, la última');
check(semanaActual(semanas, '2026-09-30').id === 'a', 'si aún no ha empezado, la primera');

console.log('\nAvisos del coach');
const base = {
  atleta: { id: 'x', nombre: 'Ana', estado: 'activo' }, bloque: { id: 'b', numero: 1, nombre: 'Base' },
  semanas: [{ id: 's1', numero: 1, programacion: 'programada', fecha_inicio: '2026-10-12' }, { id: 's2', numero: 2, programacion: 'programada', fecha_inicio: '2026-10-19' }, { id: 's3', numero: 3, programacion: 'en_programacion', fecha_inicio: '2026-10-26' }],
  semana: { id: 's2', numero: 2, fecha_inicio: '2026-10-19' }, sesiones: [{ completada: true }, { completada: false }],
  pesos: [{ kg: 61.2, fecha: '2026-10-24' }, { kg: 61.6, fecha: '2026-10-17' }],
  checkins: [{ semana_inicio: '2026-10-12', motivacion: 4, horas_sueno: '7-8' }],
  molestias: [{ zona: 'hombros', intensidad: 2 }], ultimaSerie: '2026-10-23',
};
const r = resumenAtleta(base, '2026-10-24');
const tipos = r.alertas.map((a) => a.tipo);
check(r.peso.cambio === -0.4 && r.sesiones.completadas === 1, 'peso con su cambio y sesiones hechas');
check(tipos.includes('molestia') && r.alertas[0].tipo === 'molestia', 'molestia moderada, la primera de la lista');
check(tipos.includes('programar') && r.alertas.find((a) => a.tipo === 'programar').texto === 'Programa la semana 3', 'avisa de programar la semana siguiente desde el jueves');
check(!tipos.includes('sin_entrenar') && !tipos.includes('sin_checkin'), 'sin avisos falsos de inactividad o check-in');
const r2 = resumenAtleta({ ...base, ultimaSerie: '2026-10-16', checkins: [], molestias: [] }, '2026-10-24');
check(r2.alertas.some((a) => a.tipo === 'sin_entrenar' && a.texto === '8 días sin registrar series'), 'días sin entrenar');
check(r2.alertas.some((a) => a.tipo === 'sin_checkin'), 'sin check-in reciente');
const r3 = resumenAtleta({ ...base, molestias: [{ zona: 'zona_lumbar', intensidad: 3 }] }, '2026-10-20');
check(r3.alertas[0].nivel === 'alerta' && !r3.alertas.some((a) => a.tipo === 'programar'), 'dolor grave como alerta; el lunes aún no pide programar');
check(resumenAtleta({ ...base, atleta: { ...base.atleta, estado: 'invitado' } }).alertas[0].tipo === 'invitado', 'invitado sin activar');
// v0.9: bloques que aún no han empezado o que acaban de empezar, y bloques sin nada publicado
const futuro = resumenAtleta({ ...base, bloque: { ...base.bloque, fecha_inicio: '2026-10-26' }, ultimaSerie: null, checkins: [], molestias: [] }, '2026-10-24');
check(!futuro.alertas.some((a) => a.tipo === 'sin_entrenar' || a.tipo === 'publicar'), 'un bloque que empieza el lunes que viene no avisa de «sin entrenar»');
const recien = resumenAtleta({ ...base, bloque: { ...base.bloque, fecha_inicio: '2026-10-22' }, ultimaSerie: '2026-10-10' }, '2026-10-24');
check(!recien.alertas.some((a) => a.tipo === 'sin_entrenar'), 'tras un descanso entre bloques, cuenta desde que empezó el nuevo');
const parado = resumenAtleta({ ...base, bloque: { ...base.bloque, fecha_inicio: '2026-10-12' }, ultimaSerie: '2026-10-16' }, '2026-10-24');
check(parado.alertas.some((a) => a.texto === '8 días sin registrar series'), 'pero si el bloque ya lleva días, sí avisa');
const nuevo = resumenAtleta({ ...base, bloque: { ...base.bloque, fecha_inicio: '2026-10-12' }, ultimaSerie: null }, '2026-10-24');
check(nuevo.alertas.some((a) => a.texto === 'Todavía no ha registrado ninguna serie'), 'atleta nuevo con el bloque empezado hace días: avisa');
const borradores = base.semanas.map((w) => ({ ...w, programacion: 'en_programacion' }));
const sinPublicar = resumenAtleta({ ...base, bloque: { ...base.bloque, fecha_inicio: '2026-10-12' }, semanas: borradores, semana: null, sesiones: [] }, '2026-10-24');
check(sinPublicar.alertas.some((a) => a.tipo === 'publicar' && a.texto === 'Publica la semana 1: aún no ve nada'), 'bloque en marcha sin ninguna semana publicada: pide publicar');
check(resumenAtleta({ ...base, semanas: [], semana: null, sesiones: [] }, '2026-10-24').alertas.some((a) => a.texto === 'El bloque no tiene semanas'), 'bloque sin semanas');

console.log('\nCarga de entrenamiento');
const sesC = (f, rpe, min) => ({ completada: true, fecha_realizada: f, rpe_sesion: rpe, duracion_min: min });
const sesCarga = [sesC('2026-09-21', 7, 60), sesC('2026-09-23', 7, 60), sesC('2026-09-28', 7, 60), sesC('2026-09-30', 7, 60), sesC('2026-10-05', 8, 60), sesC('2026-10-07', 7, 60),
  sesC('2026-10-12', 8, 70), sesC('2026-10-14', 9, 80), sesC('2026-10-16', 9, 75), sesC('2026-10-20', 7, 50), { completada: false, fecha_realizada: null, rpe_sesion: null, duracion_min: null }];
const cs = C.cargaSemanal(sesCarga, '2026-10-24', 6);
check(cs.length === 6 && cs[5].lunes === '2026-10-19' && cs[5].enCurso && cs[5].carga === 350 && cs[4].carga === 560 + 720 + 675, 'carga semanal: RPE de sesión × minutos, de lunes a domingo');
const cc = C.cambioCarga(cs);
check(cc && cc.semana === '2026-10-12' && cc.media === 860 && cc.ratio === 2.27, `la semana pasada frente a la media de las 4 anteriores (${cc?.ratio}×)`);
const rCarga = C.resumenAtleta({ ...base, sesionesRecientes: sesCarga }, '2026-10-24');
check(rCarga.alertas.some((a) => a.tipo === 'carga') && rCarga.carga.ratio === 2.27, 'el panel lo avisa si pasa de 1,5 veces su media');
check(C.cambioCarga(C.cargaSemanal([sesC('2026-10-12', 8, 60)], '2026-10-24', 6)) === null, 'sin historial suficiente no compara');

console.log('\nCola sin conexión');
const almacen = new Map();
globalThis.localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v), removeItem: (k) => almacen.delete(k) };
globalThis.window = { addEventListener() {} };
const { crearCola } = await import('../web/src/datos/cola.js');
let red = false;
const enviadas = [];
const apiFalsa = {
  async guardarSerie(d) { if (!red) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; } enviadas.push(d.numero); },
  async borrarSerie() {}, async marcarSesion() {},
};
const cola = crearCola(apiFalsa, { clave: 'prueba' });
cola.fijarAtleta('a');
const r1 = await cola.enviar({ tipo: 'serie', datos: { numero: 1 }, atletaId: 'a' });
await cola.enviar({ tipo: 'serie', datos: { numero: 2 }, atletaId: 'a' });
check(r1.enCola && cola.pendientes() === 2, 'sin conexión, las series quedan en cola');
check(JSON.parse(almacen.get('prueba')).length === 2, 'y sobreviven a cerrar la app (localStorage)');
red = true;
await cola.vaciar();
check(cola.pendientes() === 0 && igual(enviadas, [1, 2]), 'al volver la conexión se envían en orden');
const r4 = await cola.enviar({ tipo: 'serie', datos: { numero: 3 }, atletaId: 'a' });
check(!r4.enCola && enviadas.at(-1) === 3, 'con conexión se envía al momento');
{
  // Con conexión, todo va en una sola fila: una corrección lenta no llega después del borrado que la sigue
  const orden = [];
  const lenta = {
    async guardarSerie(d) { await new Promise((r) => setTimeout(r, 40)); orden.push(`guardar ${d.numero}`); },
    async borrarSerie(_, n) { orden.push(`borrar ${n}`); }, async marcarSesion() {},
  };
  const c2 = crearCola(lenta, { clave: 'prueba-orden' });
  c2.fijarAtleta('a');
  await Promise.all([c2.enviar({ tipo: 'serie', datos: { numero: 4 }, atletaId: 'a' }), c2.enviar({ tipo: 'borrarSerie', datos: { sesion_ejercicio_id: 'x', numero: 4 }, atletaId: 'a' })]);
  check(igual(orden, ['guardar 4', 'borrar 4']), 'las operaciones llegan en el orden en que se hicieron');
  // Lo que el servidor rechaza no se pierde en silencio
  let redR = false;
  const rechazos = [];
  const exigente = {
    async guardarSerie(d) {
      if (!redR) { const e = new Error('Sin conexión.'); e.sinConexion = true; throw e; }
      if (!Number.isInteger(d.reps)) throw new Error('invalid input syntax for type integer');
    },
    async borrarSerie() {}, async marcarSesion() {},
  };
  const c3 = crearCola(exigente, { clave: 'prueba-rechazo', claveRechazos: 'prueba-rechazadas' });
  c3.fijarAtleta('a');
  c3.alRechazo((op) => rechazos.push(op.datos.numero));
  await c3.enviar({ tipo: 'serie', datos: { numero: 1, reps: 8 }, atletaId: 'a' });
  await c3.enviar({ tipo: 'serie', datos: { numero: 2, reps: 8.5 }, atletaId: 'a' });
  redR = true;
  await c3.vaciar();
  check(c3.pendientes() === 0 && igual(rechazos, [2]) && c3.rechazadas().length === 1 && c3.rechazadas()[0].datos.numero === 2, 'si el servidor rechaza una serie de la cola, se avisa y se guarda aparte');
  // Cada atleta solo envía lo suyo; lo de otro espera en el móvil
  redR = false;
  await c3.enviar({ tipo: 'serie', datos: { numero: 5, reps: 5 }, atletaId: 'a' });
  c3.fijarAtleta('b');
  redR = true;
  await c3.vaciar();
  check(c3.pendientes() === 0 && JSON.parse(almacen.get('prueba-rechazo')).length === 1, 'con otra persona en el móvil, lo pendiente de la primera no se envía ni se pierde');
  c3.fijarAtleta('a');
  await c3.vaciar();
  check(c3.pendientes() === 0 && JSON.parse(almacen.get('prueba-rechazo')).length === 0, 'y se envía cuando vuelve a entrar');
  c3.fijarAtleta(null);
  check(await c3.enviar({ tipo: 'serie', datos: { numero: 6, reps: 5 }, atletaId: 'a' }).then(() => false, () => true), 'sin sesión de atleta no se envía nada');
}

console.log('\nAjustes de este móvil');
{
  const { leerAjustes, guardarAjustes } = await import('../web/src/ui/ajustes.js');
  check(leerAjustes().sonidoDescanso === 'tres-beeps' && leerAjustes().cuentaAtras === true, 'de serie: tres beeps y pitidos en los 3 últimos segundos');
  guardarAjustes({ ...leerAjustes(), sonidoDescanso: 'boxeo' });
  check(leerAjustes().sonidoDescanso === 'boxeo', 'si el navegador no deja guardar (aquí no hay almacenamiento), lo elegido vale igual mientras la app está abierta');
}

console.log('\nBúsqueda rápida del coach');
{
  const { construirResultados } = await import('../web/src/logica/busqueda.js');
  const datos = {
    atletas: [
      { id: 'j', nombre: 'Juan Martín', estado: 'activo', objetivo: 'Fuerza' },
      { id: 'a', nombre: 'Ana López', estado: 'activo', objetivo: 'Hipertrofia' },
      { id: 'l', nombre: 'Lucía Prueba', estado: 'invitado' },
      { id: 'b', nombre: 'Bea Antigua', estado: 'baja' },
    ],
    plantillas: [{ id: 'p1', nombre: 'Torso pierna 4 días' }],
    ejercicios: [
      { id: 'e1', nombre: 'Press banca', grupos_musculares: ['pectoral', 'triceps'] },
      { id: 'e2', nombre: 'Press militar', grupos_musculares: ['deltoides'] },
      { id: 'e3', nombre: 'Banca inclinada (oculto)', grupos_musculares: ['pectoral'], activo: false },
    ],
  };
  const vacio = construirResultados(datos, '');
  check(vacio.filter((x) => x.grupo === 'Atletas').length === 3 && !vacio.some((x) => x.titulo === 'Bea Antigua'), 'sin escribir, propone los atletas que no están de baja');
  check(vacio.some((x) => x.grupo === 'Acciones') && vacio.some((x) => x.grupo === 'Ir a') && !vacio.some((x) => x.grupo === 'Ejercicios'), 'y acciones y secciones, pero no la biblioteca entera');
  const lu = construirResultados(datos, 'LUCIA');
  check(lu[0]?.titulo === 'Lucía Prueba' && lu[0].destino.atletaId === 'l', 'sin tildes ni mayúsculas, «LUCIA» encuentra a Lucía');
  const seg = construirResultados(datos, 'ana segui');
  check(seg[0]?.titulo === 'Ana López: Seguimiento' && seg[0].destino.pestana === 'seguimiento', '«ana segui» propone primero su pestaña Seguimiento');
  check(seg[1]?.titulo === 'Ana López' && seg[1].destino.pestana === 'programa', 'y después su ficha');
  const pro = construirResultados(datos, 'pro');
  check(!pro.some((x) => x.grupo === 'Atletas'), '«pro» a secas no lista a todos los atletas como si pidiera Programa');
  const an = construirResultados(datos, 'an').filter((x) => x.grupo === 'Atletas');
  check(an[0]?.titulo === 'Ana López' && !an.some((x) => x.titulo === 'Juan Martín'), 'busca por principio de palabra: «an» es Ana (o Bea Antigua), no Juan');
  const datos2 = { ...datos, atletas: [...datos.atletas, { id: 'c', nombre: 'Carlos Vera', estado: 'activo', objetivo: 'Dos días por semana' }] };
  check(!construirResultados(datos2, 'ana').some((x) => x.titulo === 'Carlos Vera'), '«ana» no encuentra a quien entrena «por semana»');
  check(construirResultados(datos2, 'semana').some((x) => x.titulo === 'Carlos Vera'), 'pero su objetivo sí cuenta para buscarlo');
  check(construirResultados(datos, 'bea').some((x) => x.titulo === 'Bea Antigua'), 'buscando, también aparece quien está de baja');
  const datos3 = { ...datos, atletas: [...datos.atletas, { id: 'f', nombre: 'Lucía Ferrer', estado: 'activo', entrenamiento: false }] };
  const lr = construirResultados(datos3, 'lucia regis');
  check(lr[0]?.titulo === 'Lucía Prueba: Registro' && !lr.some((x) => x.titulo === 'Lucía Ferrer: Registro'), 'a quien solo lleva la nutrición no le propone pestañas de entrenamiento');
  check(construirResultados(datos3, 'ferrer')[0]?.destino.pestana === 'nutricion', 'y su ficha se abre en Nutrición');
  const pb = construirResultados(datos, 'press');
  check(pb.filter((x) => x.grupo === 'Ejercicios').length === 2, '«press» encuentra los dos press de la biblioteca');
  check(construirResultados(datos, 'triceps').some((x) => x.titulo === 'Press banca'), 'un ejercicio también se encuentra por sus músculos');
  check(construirResultados(datos, 'banca').filter((x) => x.grupo === 'Ejercicios').length === 1, '«banca» encuentra Press banca por su segunda palabra');
  check(!construirResultados(datos, 'inclinada').some((x) => x.grupo === 'Ejercicios'), 'los ejercicios ocultos no se proponen');
  check(construirResultados(datos, 'torso')[0]?.destino.plantillaId === 'p1', 'encuentra plantillas');
  check(construirResultados(datos, 'nueva plan').some((x) => x.destino.nueva), 'y la acción de crear una plantilla');
  check(construirResultados(datos, 'zzz').length === 0, 'sin coincidencias, nada');
}

console.log('\nLogros');
{
  const { rachaMaxima, calcularLogros, logrosNuevos, nivelesVistos } = await import('../web/src/logica/logros.js');
  const sem = (f, total, hechas) => ({ fecha_inicio: f, total, hechas });
  const lista = [sem('2026-09-07', 3, 3), sem('2026-09-14', 3, 3), sem('2026-09-21', 3, 3), sem('2026-09-28', 3, 2), sem('2026-10-05', 3, 3), sem('2026-10-12', 0, 0), sem('2026-10-19', 3, 1)];
  check(rachaMaxima(lista, '2026-10-24') === 3, 'racha más larga: 3 semanas completas (la incompleta la corta; la vacía y la de esta semana a medias, no)');
  check(rachaMaxima([sem('2026-10-19', 3, 3), sem('2026-10-26', 3, 3)], '2026-10-24') === 1, 'las semanas futuras no cuentan');
  const l = calcularLogros({ sesiones: 12, racha: 0, toneladas: 0, records: 0, videos: 0, checkins: 5, peso: 40 });
  const ses = l.find((x) => x.id === 'sesiones');
  check(ses.nivel === 2 && ses.color === 'amarillo' && ses.siguiente.umbral === 50 && ses.siguiente.falta === 38, '12 sesiones: disco amarillo, siguiente a las 50 (faltan 38)');
  check(Math.abs(ses.progreso - 2 / 40) < 1e-9, 'el aro marca el avance desde el nivel conseguido hasta el siguiente');
  check(l.find((x) => x.id === 'records').nivel === 0 && l.find((x) => x.id === 'records').siguiente.umbral === 1, 'sin récords: sin disco, el primero al primer récord');
  const todo = calcularLogros({ sesiones: 500, racha: 20, toneladas: 300, records: 80, videos: 40, checkins: 30, peso: 200 });
  check(todo.every((x) => x.nivel === 4 && x.siguiente === null && x.progreso === 1 && x.color === 'rojo'), 'con todo, los siete en disco rojo');
  check(calcularLogros({}, { salud: false }).every((x) => x.id !== 'peso' && x.id !== 'checkins'), 'sin consentimiento de salud no hay logros de peso ni de check-ins');
  const nuevos = logrosNuevos(l, { sesiones: 1, checkins: 2 });
  check(nuevos.length === 2 && nuevos.find((x) => x.id === 'sesiones').nivel === 2 && nuevos.find((x) => x.id === 'peso').nivel === 2, 'nuevos: solo los que han subido de nivel desde lo visto');
  check(logrosNuevos(l, nivelesVistos(l)).length === 0, 'una vez vistos, nada nuevo');
}

console.log('\nCumplimiento e informe del bloque');
{
  const { cumplimiento, informeBloque } = await import('../web/src/logica/informe.js');
  const ses = [
    { id: 's1', semana_id: 'w1', completada: true, fecha_realizada: '2026-10-05', duracion_min: 60 },
    { id: 's2', semana_id: 'w1', completada: false },
    { id: 's3', semana_id: 'w2', completada: true, fecha_realizada: '2026-10-12', duracion_min: 50 },
    { id: 's4', semana_id: 'w3', completada: false },
  ];
  const pautas = [
    { id: 'p1', sesion_id: 's1', series: 3, rpe_objetivo: 8, prioridad: 'alta' },
    { id: 'p2', sesion_id: 's2', series: 3, rir_objetivo: 2 },
    { id: 'p3', sesion_id: 's3', series: 3, rpe_objetivo: 8, prioridad: 'alta' },
    { id: 'p4', sesion_id: 's4', series: 4, rpe_objetivo: 8 },
  ];
  const serie = (pe, ses_, fecha, kg, reps, rpe, extra = {}) => ({ sesion_ejercicio_id: pe, sesion_id: ses_, fecha, ejercicio_id: 'press', ejercicio: 'Press banca', grupos: ['pectoral', 'triceps'], kg, reps, rpe, ...extra });
  const series = [
    serie('p1', 's1', '2026-10-05', 60, 5, 8), serie('p1', 's1', '2026-10-05', 60, 5, 8.5), serie('p1', 's1', '2026-10-05', 60, 5, 9),
    serie('p1', 's1', '2026-10-05', 60, 5, 9), // una de más: no cuenta por encima de lo pautado
    serie('p3', 's3', '2026-10-12', 65, 5, 8), serie('p3', 's3', '2026-10-12', 65, 5, 8),
  ];
  const semanas = [{ id: 'w1', numero: 1, fecha_inicio: '2026-10-05', foco: 'volumen' }, { id: 'w2', numero: 2, fecha_inicio: '2026-10-12' }, { id: 'w3', numero: 3, fecha_inicio: '2026-10-19' }];
  const lunesDe = { w1: '2026-10-05', w2: '2026-10-12', w3: '2026-10-19' };
  const c = cumplimiento({ sesiones: ses.map((x) => ({ ...x, semana_lunes: lunesDe[x.semana_id] })), pautas, series }, '2026-10-21');
  check(c.sesiones.hechas === 2 && c.sesiones.total === 3, 'cumplimiento: las sesiones de esta semana sin hacer aún no cuentan (2 de 3)');
  check(c.series.hechas === 5 && c.series.pautadas === 9 && c.series.pct === 56, 'series: como mucho las pautadas por ejercicio (5 de 9)');
  check(c.esfuerzo.conEsfuerzo === 6 && c.esfuerzo.encima === 2, 'esfuerzo: «por encima» es más de medio punto sobre el objetivo (las dos a 9 sobre 8; 8,5 no)');
  const inf = informeBloque({ bloque: { id: 'b', nombre: 'Fuerza', numero: 2 }, semanas, sesiones: ses, pautas, series, eventos: [{ sesion_id: 's3', ejercicio: 'Press banca', fecha: '2026-10-12', record: { texto: '65 kg a 5', tipo: 'kg' } }], pesos: [] }, '2026-10-21');
  check(inf.inicio === '2026-10-05' && inf.fin === '2026-10-25' && !inf.terminado && inf.semanasTotal === 3, 'informe: del lunes de la primera semana al domingo de la última, en curso');
  check(inf.sesiones.hechas === 2 && inf.tonelaje === 60 * 5 * 4 + 65 * 5 * 2, 'cuenta sesiones y tonelaje (con todas las series hechas)');
  const pr = inf.principales[0];
  check(pr.nombre === 'Press banca' && pr.valores[0] > 0 && pr.valores[1] > pr.valores[0] && pr.valores[2] === null && pr.cambio > 0, 'fuerza estimada del ejercicio principal por semana, con su subida');
  check(inf.semanas[2].futura === false && inf.semanas[1].cumplimiento.series.pct === 67, 'semana a semana, con su cumplimiento');
  check(inf.records.length === 1 && inf.musculos.pectoral === 3, 'récords del bloque y series semanales medias por músculo (6 en 2 semanas)');
  check(informeBloque({ bloque: { id: 'x', nombre: 'Vacío' }, semanas: [], sesiones: [] }, '2026-10-21') === null, 'sin semanas publicadas, no hay informe');
  const fin = informeBloque({ bloque: { id: 'b', nombre: 'Fuerza' }, semanas, sesiones: ses, pautas, series, eventos: [], pesos: [] }, '2026-11-02');
  check(fin.terminado && fin.cumplimiento.sesiones.total === 4, 'acabado el bloque, cuentan todas sus sesiones');
}

console.log('\n¿Cómo llegas hoy?');
{
  const { consejoPreparacion, completa, textoPreparacion } = await import('../web/src/logica/preparacion.js');
  check(consejoPreparacion({ sueno: 3, energia: 3, molestias: 3 }).nivel === 'bien' && !consejoPreparacion({ sueno: 3, energia: 2, molestias: 3 }).frenar, 'bien o normal: sigue la pauta y puede proponer subir carga');
  check(consejoPreparacion({ sueno: 1, energia: 3, molestias: 3 }).nivel === 'flojo' && consejoPreparacion({ sueno: 1, energia: 3, molestias: 3 }).frenar, 'una respuesta mala: día flojo, sin subir carga');
  check(consejoPreparacion({ sueno: 2, energia: 2, molestias: 2 }).nivel === 'flojo', 'todo regular: día flojo');
  check(consejoPreparacion({ sueno: 3, energia: 3, molestias: 1 }).nivel === 'malo', 'con bastantes molestias: día difícil');
  check(consejoPreparacion({ sueno: 1, energia: 1, molestias: 2 }).nivel === 'malo', 'durmió mal y sin energía: día difícil');
  check(consejoPreparacion({ sueno: 1, energia: 2 }) === null && !completa({ sueno: 4, energia: 2, molestias: 2 }), 'incompleta o fuera de rango: sin consejo');
  check(textoPreparacion({ sueno: 1, energia: 2, molestias: 3 }) === 'Sueño: mal. Energía: normal. Agujetas o molestias: ninguna', 'el coach lo lee en una línea');
}

console.log('\nMomentos del vídeo y ficha del ejercicio');
{
  const { partirMomentos, textoMomento } = await import('../web/src/logica/momentos.js');
  const p = partirMomentos('0:04 rodillas hacia dentro; en 1:02,5 mejor');
  check(p[0].momento === '0:04' && p[0].t === 4 && p[2].t === 62.5, 'reconoce «0:04» y «1:02,5» en un comentario');
  check(!partirMomentos('Nos vemos a las 18:00').some((x) => x.momento), '«a las 18:00» es una hora, no un momento del vídeo');
  check(!partirMomentos('3x8 a 60 kg, 10:5 no').some((x) => x.momento), 'sin minutos válidos, todo es texto');
  check(textoMomento(1.56, true) === '0:01,5' && textoMomento(75) === '1:15', 'escribe los momentos con décimas si hace falta');
  const { serieSemanal, recortarRango, metricasDe, tablaRecords } = await import('../web/src/logica/ejercicio.js');
  const s = (fecha, kg, reps, rpe = 8) => ({ fecha, kg, reps, rpe });
  const series = [s('2026-06-01', 60, 5), s('2026-06-03', 62.5, 5), s('2026-10-12', 70, 5), s('2026-10-12', 72.5, 3, 9), s('2026-10-19', 75, 1, 10)];
  const vol = serieSemanal(series, 'volumen');
  check(vol.length === 3 && vol[0].valor === 60 * 5 + 62.5 * 5, 'volumen: suma de la semana');
  check(serieSemanal(series, 'carga').at(-1).valor === 75 && serieSemanal(series, 'e1rm').at(-1).valor === 75, 'mejor carga y 1RM estimado de la semana (1 a RPE 10 = la carga)');
  check(recortarRango(vol, '3m', '2026-10-24').length === 2 && recortarRango(vol, 'todo', '2026-10-24').length === 3, 'el rango recorta las semanas');
  check(metricasDe([{ kg: 0, reps: 12 }]).map((m) => m.id).join() === 'reps' && metricasDe(series).length === 3, 'sin carga, solo repeticiones');
  const t = tablaRecords(series, 80);
  check(t.find((f) => f.reps === 5).real.kg === 70 && t.find((f) => f.reps === 1).estimado === 80 && t.find((f) => f.reps === 10).estimado === 60, 'tabla de récords: lo real a cada repetición y lo estimado con Epley');
}

console.log('\nCargas sugeridas, objetivos de fuerza y tempo (v0.8)');
{
  const { sugerirCargas } = await import('../web/src/logica/sugerencias.js');
  const pa = (id, sesion_id, ejercicio_id, extra = {}) => ({ id, sesion_id, ejercicio_id, series: 3, reps_min: 6, reps_max: 8, rir_objetivo: 2, ...extra });
  const antes = [pa('p1', 's1', 'A'), pa('p2', 's1', 'B'), pa('p3', 's1', 'C', { series: 2 }), pa('p5', 's1', 'E')];
  const ahora = [pa('q1', 'n1', 'A', { carga_sugerida_kg: 100 }), pa('q2', 'n1', 'B', { carga_sugerida_kg: 60 }), pa('q3', 'n1', 'C', { series: 2, carga_sugerida_kg: 50 }), pa('q4', 'n1', 'D'), pa('q5', 'n1', 'E')];
  const series = {
    p1: [1, 2, 3].map(() => ({ kg: 100, reps: 8, rir: 2 })),
    p2: [{ kg: 60, reps: 8, rpe: 9.5 }, { kg: 60, reps: 8, rpe: 9 }],
    p3: [{ kg: 50, reps: 6, rir: 2 }, { kg: 50, reps: 5, rir: 2 }],
    p5: [{ kg: 40, reps: 8, sustituto_id: 'X' }],
  };
  const arg = { ahora, antes, series, sesionesAhora: [{ id: 'n1', orden: 1 }], sesionesAntes: [{ id: 's1', orden: 1 }], nombres: { A: 'Sentadilla barra alta', B: 'Press banca', C: 'Remo con barra', D: 'Hip thrust', E: 'Remo gironda' } };
  const f = Object.fromEntries(sugerirCargas(arg).map((x) => [x.pauta_id, x]));
  check(f.q1.propuesta === 102.5 && f.q1.tipo === 'subir' && f.q1.cambia, 'llegó al tope del rango en todas sin pasarse: sube un salto (100 → 102,5)');
  check(f.q2.propuesta === 60 && /pasó del esfuerzo/.test(f.q2.motivo) && !f.q2.cambia, 'se pasó del esfuerzo pautado: la misma carga');
  check(f.q3.propuesta === 50 && f.q3.tipo === 'mantener', 'no completó el rango: la misma carga');
  check(f.q4.propuesta === null && /No estaba/.test(f.q4.motivo) && f.q5.propuesta === null && /cambió por otro/.test(f.q5.motivo), 'sin datos comparables no propone nada (ejercicio nuevo o cambiado por otro)');
  const d = Object.fromEntries(sugerirCargas({ ...arg, foco: 'descarga' }).map((x) => [x.pauta_id, x.propuesta]));
  check(d.q1 === 90 && d.q2 === 55 && d.q3 === 45, 'semana de descarga: un 10 % menos, redondeado a su salto de carga');

  const { progresoObjetivo, metaE1rm } = await import('../web/src/logica/objetivos.js');
  const hoy = '2026-10-24';
  const ser = (fecha, kg, reps, extra = {}) => ({ ejercicio_id: 'B', fecha, kg, reps, registrada_en: `${fecha}T18:00:00Z`, ...extra });
  const hist = [ser('2026-09-14', 50, 5), ser('2026-09-21', 52.5, 5), ser('2026-09-28', 55, 5), ser('2026-10-05', 55, 6), ser('2026-10-12', 57.5, 5), ser('2026-10-19', 57.5, 6), ser('2026-10-19', 90, 5, { ejercicio_id: 'Z' })];
  check(metaE1rm(62.5, 1) === 62.5 && metaE1rm(80, 3) === 88, 'la meta es el 1RM estimado de la marca al fallo');
  const g = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 80, reps_objetivo: 1, e1rm_inicio: 58.3, creado_en: '2026-09-20T10:00:00Z', fecha_limite: '2026-11-15' }, hist, hoy);
  check(g.meta === 80 && g.actual === 69 && g.pct === Math.round((69 - 58.3) / (80 - 58.3) * 100), 'progreso desde el punto de partida (solo cuenta su ejercicio)');
  check(g.prevision && g.prevision.ritmo > 1.5 && g.prevision.ritmo < 2.5 && g.prevision.aTiempo === false, 'previsión por la tendencia semanal: llega más tarde de la fecha');
  const c = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 55, reps_objetivo: 5, creado_en: '2026-09-25T10:00:00Z' }, hist, hoy);
  check(c.pct === 100 && c.conseguido.fecha === '2026-09-28' && c.inicio === 61.3, 'conseguido con la primera serie real que la iguala; sin punto de partida guardado, el de las 6 semanas previas');
  const mismoDia = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 55, reps_objetivo: 5, creado_en: '2026-09-28T19:00:00Z' }, hist, hoy);
  check(mismoDia.conseguido.fecha === '2026-10-05', 'las series de antes de poner el objetivo no cuentan, aunque sean del mismo día');
  const ya = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 62.5, reps_objetivo: 1, e1rm_inicio: 58.3, creado_en: '2026-09-20T10:00:00Z' }, hist, hoy);
  check(ya.yaLoPermite && ya.pct === 99 && !ya.conseguido, 'si su 1RM estimado ya lo permite, se avisa sin darlo por conseguido');
  const viejo = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 80, reps_objetivo: 1, creado_en: '2026-03-01T10:00:00Z' }, hist.map((s) => ({ ...s, fecha: s.fecha.replace(/-(09|10)-/, '-04-'), registrada_en: null })), hoy);
  check(viejo.actual === null && viejo.sinRecientes && viejo.prevision === null, 'sin series en las últimas 6 semanas: ni progreso actual ni previsión');
  const quince = progresoObjetivo({ ejercicio_id: 'B', kg_objetivo: 40, reps_objetivo: 15 }, hist, hoy);
  check(quince.meta === null && !quince.yaLoPermite && quince.pct === 0, 'una marca que no se puede estimar no da «ya lo permite»');
  check(progresoObjetivo({ ejercicio_id: null, kg_objetivo: 60, reps_objetivo: 1 }, hist, hoy) === null, 'sin ejercicio, objetivo manual');

  const { leerTempo, tempoDe, explicarTempo, posicionTempo } = await import('../web/src/logica/tempo.js');
  const t = leerTempo('3-1-1');
  check(t.texto === '3-1-1' && t.total === 5 && t.fases.map((x) => x.nombre).join() === 'Baja,Pausa abajo,Sube', 'lee «3-1-1»: baja, pausa y sube');
  const x = leerTempo('31x0');
  check(x.texto === '31X0' && x.fases[2].explosiva && x.total === 5, 'lee «31X0» (X = subida explosiva, cuenta 1 s)');
  check([null, '', '3-1', '10-1-1', 'abc', '0-0-0'].every((v) => leerTempo(v) === null), 'rechaza lo que no es un tempo');
  check(tempoDe({ tempo: null, variante: 'Tempo 3-1-1: baja en 3 s' })?.texto === '3-1-1' && tempoDe({ tempo: '2-0-1', variante: 'Tempo 3-1-1' }).texto === '2-0-1', 'el campo de tempo manda; si no, se busca en la variante');
  check(explicarTempo(t) === 'Baja en 3 s, 1 s abajo y sube en 1 s', 'lo explica en una frase');
  check(igual(posicionTempo(6.5, t), { rep: 1, fase: 0, enFase: 1.5, quedan: 1.5 }) && posicionTempo(3.2, t).fase === 1 && posicionTempo(-1, t) === null, 'sabe en qué repetición y fase va');
  check(posicionTempo(2.5, leerTempo('2-0-1')).fase === 2, 'salta las fases de 0 s');
}

console.log('\nErrores corregidos en la v0.9');
{
  const { inicioDeTanda, problemaSerie, resumenSemanal } = await import('../web/src/logica/calculos.js');
  const { semanaCheckin, diaDeCheckin } = await import('../web/src/logica/fechas.js');
  const { textoMomento } = await import('../web/src/logica/momentos.js');
  const h = (iso) => ({ registrada_en: iso });
  const ahora = Date.parse('2026-10-25T00:40:00+02:00');
  const t = inicioDeTanda([h('2026-10-24T23:10:00+02:00'), h('2026-10-24T23:50:00+02:00'), h('2026-10-25T00:30:00+02:00')], ahora);
  check(t === Date.parse('2026-10-24T23:10:00+02:00'), 'el cronómetro de una sesión que pasa de la medianoche no vuelve a cero');
  check(inicioDeTanda([h('2026-10-24T18:00:00+02:00')], Date.parse('2026-10-25T10:00:00+02:00')) === null, 'retomarla al día siguiente sí empieza de cero');
  check(inicioDeTanda([h('2026-10-24T09:00:00+02:00'), h('2026-10-24T18:00:00+02:00')], Date.parse('2026-10-24T18:20:00+02:00')) === Date.parse('2026-10-24T18:00:00+02:00'), 'y una tanda de la mañana no cuenta para la de la tarde');
  check(semanaCheckin('2026-10-26') === '2026-10-19' && semanaCheckin('2026-10-25') === '2026-10-19' && semanaCheckin('2026-10-27') === '2026-10-26', 'el lunes, el check-in es el de la semana que acaba de terminar');
  check(diaDeCheckin(new Date('2026-10-25T12:00:00')) && diaDeCheckin(new Date('2026-10-26T12:00:00')) && !diaDeCheckin(new Date('2026-10-27T12:00:00')), 'el recordatorio del check-in sale de viernes a lunes (también el domingo)');
  check(textoMomento(4.3, true) === '0:04,3' && textoMomento(2.3, true) === '0:02,3' && textoMomento(1.56, true) === '0:01,5', 'los momentos del vídeo no pierden una décima por el redondeo');
  check(problemaSerie({ kg: 60, reps: 8.5 }) && problemaSerie({ kg: 10000, reps: 5 }) && problemaSerie({ kg: -20, reps: 5 }) && !problemaSerie({ kg: 62.5, reps: 8 }) && !problemaSerie({ kg: null, reps: 12 }), 'una serie con repeticiones decimales o kilos imposibles no se guarda (ni se queda en la cola)');
  const sesTu = [
    { id: 'a', semana_lunes: '2026-10-19', completada: true, fecha_realizada: '2026-10-20' },
    { id: 'b', semana_lunes: '2026-10-19', completada: true, fecha_realizada: '2026-10-22' },
    { id: 'c', semana_lunes: '2026-10-19', completada: false },
    { id: 'z', semana_lunes: '2026-10-12', completada: true, fecha_realizada: '2026-10-21' },
  ];
  const rs = resumenSemanal({ series: [], sesiones: sesTu, pesos: [] }, '2026-10-19');
  check(rs.sesiones.hechas === 3 && !rs.sesiones.completa, 'Tu semana no dice «Semana completa» si falta una sesión de esa semana, aunque recuperase una atrasada');
  const { seriesACsv } = await import('../web/src/logica/calculos.js');
  check(seriesACsv([{ fecha: '2026-10-20', ejercicio: 'Press', numero: 1, kg: 50, reps: 5, nota: '@SUM(A1)' }]).includes("'@SUM(A1)"), 'el CSV neutraliza lo que Excel tomaría por una fórmula');
}

console.log('\nv0.10: serie top + back-off');
{
  const { esTopBackoff, cargaBackoff, sugerenciaProgresion } = await import('../web/src/logica/calculos.js');
  const se = { series: 4, reps_min: 4, reps_max: 6, rpe_objetivo: 8, carga_sugerida_kg: 100, backoff_pct: 10 };
  check(esTopBackoff(se) && !esTopBackoff({ ...se, series: 1 }) && !esTopBackoff({ ...se, backoff_pct: null }), 'reconoce una pauta con serie top y back-off (al menos dos series)');
  check(pauta(se).series === '1 × 4–6 + 3 × \u221210 %' && pauta(se).top, 'el texto de la pauta: «1 × 4–6 + 3 × −10 %»');
  check(cargaBackoff(100, 10, 'Sentadilla barra alta') === 90 && cargaBackoff(102.5, 10, 'Press banca') === 92.5, 'back-off con barra: un 10 % menos, a 2,5 kg');
  check(cargaBackoff(16, 10, 'Press inclinado con mancuernas') === 14 && cargaBackoff(42.5, 10, 'Press banca') === 37.5, 'con mancuernas, a 2 kg; y redondea al salto más cercano');
  check(cargaBackoff(5, 50, 'Press banca') === 2.5 && cargaBackoff(null, 10) === null && cargaBackoff(60, 0) === null, 'nunca menos de un salto, y sin top o sin % no hay back-off');
  const ultTop = [{ numero: 1, kg: 100, reps: 6, rpe: 8 }, { numero: 2, kg: 90, reps: 5, rpe: 7 }, { numero: 3, kg: 90, reps: 4, rpe: 7.5 }, { numero: 4, kg: 90, reps: 4, rpe: 8 }];
  const sg = sugerenciaProgresion(se, ultTop, { nombre: 'Sentadilla barra alta' });
  check(sg?.tipo === 'subir' && sg.kg === 102.5 && sg.texto.includes('top'), 'la doble progresión mira solo la top: llegó a 6 @8 → sube la top a 102,5 (aunque las back-off no llegaran)');
  check(sugerenciaProgresion({ ...se, backoff_pct: null }, ultTop, { nombre: 'Sentadilla barra alta' })?.tipo !== 'subir', 'sin top + back-off, las series que no llegan sí frenan la subida');
  const { propuestaBackoff } = await import('../web/src/logica/calculos.js');
  const pb = (k, hechas) => propuestaBackoff(se, k, hechas, { kg: 100, reps: 6 }, 'Sentadilla barra alta');
  check(pb(2, {}).kg === 90 && pb(2, { 1: { kg: 110, reps: 5 } }).kg === 100 && pb(2, { 1: { kg: 110, reps: 5 } }).desdeTop, 'en la sesión, la back-off sale de la top propuesta y, en cuanto la hace, de lo que hizo de verdad');
  check(pb(3, { 1: { kg: 110, reps: 5 }, 2: { kg: 97.5, reps: 6 } }) === null && pb(3, { 1: { kg: 110, reps: 5 } }).kg === 100 && pb(1, {}) === null, 'la siguiente back-off repite la anterior si ya la hizo (la top va aparte)');
  // Revisión independiente
  check(pb(5, { 1: { kg: 110, reps: 5 } })?.kg === 100 && pb(6, {})?.kg === 90, 'una serie de más tras top + back-off también es back-off (antes podía salir a la carga de la top)');
  check(cargaBackoff(50, 5, 'Prensa de piernas') === 45 && cargaBackoff(20, 5, 'Press con mancuernas') === 18 && cargaBackoff(25, 5, 'Press banca') === 22.5,
    'si el redondeo se come el %, la back-off baja un salto: nunca queda igual que la top');
  check(cargaBackoff(2, 10, 'Elevaciones laterales con mancuernas') === 1.5 || cargaBackoff(2, 10, 'Elevaciones laterales con mancuernas') === null, 'con cargas tan pequeñas que no hay un salto por debajo, nunca iguala la top');
  check(pauta({ series: 3, reps_min: null, reps_max: null, backoff_pct: 10 }).series === 'Top + 2 × \u221210 %', 'sin repeticiones pautadas: «Top + 2 × −10 %»');
  const recta = { series: 4, reps_min: 4, reps_max: 6, rpe_objetivo: 8, backoff_pct: null };
  check(sugerenciaProgresion(recta, ultTop, { nombre: 'Sentadilla barra alta', pautaAnterior: se }) === null,
    'de top + back-off a series iguales no se sugiere nada (lo que aguantó en la top no dice qué aguantan las cuatro)');
  const { sugerirCargas } = await import('../web/src/logica/sugerencias.js');
  const cs = sugerirCargas({ ahora: [{ id: 'n', sesion_id: 's2', ejercicio_id: 'sq', ...recta, carga_sugerida_kg: null }], antes: [{ id: 'v', sesion_id: 's1', ejercicio_id: 'sq', ...se }],
    series: { v: ultTop }, sesionesAhora: [{ id: 's2', orden: 1 }], sesionesAntes: [{ id: 's1', orden: 1 }], nombres: { sq: 'Sentadilla barra alta' } });
  check(cs[0].propuesta === null && /series iguales/.test(cs[0].motivo), 'y al coach se lo dice así, en vez de «Dentro del rango: que sume repeticiones»');
  const cs2 = sugerirCargas({ ahora: [{ id: 'n', sesion_id: 's2', ejercicio_id: 'sq', ...se, carga_sugerida_kg: null }], antes: [{ id: 'v', sesion_id: 's1', ejercicio_id: 'sq', ...se }],
    series: { v: ultTop }, sesionesAhora: [{ id: 's2', orden: 1 }], sesionesAntes: [{ id: 's1', orden: 1 }], nombres: { sq: 'Sentadilla barra alta' } });
  check(cs2[0].propuesta === 102.5 && /la serie top/.test(cs2[0].motivo), 'con top + back-off las dos semanas, sube la top y lo explica por la top («en todas» no era verdad)');
  const { leerNumero } = await import('../web/src/logica/calculos.js');
  check(leerNumero('8.000') === 8000 && leerNumero('12.500') === 12500 && leerNumero('8 000') === 8000 && leerNumero('2,5') === 2.5 && leerNumero('2.5') === 2.5
    && leerNumero('12.500,5') === 12500.5 && leerNumero('') === null && leerNumero('abc') === null && leerNumero('80,55') === 80.55,
    'al escribir a mano: «8.000» son ocho mil (antes, 8 pasos), «2,5» y «2.5» dos y medio');
}

console.log('\nv0.10: hábitos');
{
  const { cumpleHabito, fraccionHabito, resumenHabito, textoObjetivo, textoValor, cumplimientoHabitos, pasoHabito } = await import('../web/src/logica/habitos.js');
  const pasos = { id: 'p', tipo: 'numero', objetivo: 8000, unidad: 'pasos', sentido: 'al_menos', dias_semana: 6, creado_en: '2026-09-01T09:00:00Z' };
  const cafe = { id: 'c', tipo: 'numero', objetivo: 2, unidad: 'cafés', sentido: 'como_mucho', dias_semana: 7, creado_en: '2026-09-01T09:00:00Z' };
  const mov = { id: 'm', tipo: 'si_no', objetivo: null, sentido: 'al_menos', dias_semana: 3, creado_en: '2026-10-12T09:00:00Z' };
  check(cumpleHabito(pasos, 8000) && !cumpleHabito(pasos, 7999) && cumpleHabito(cafe, 2) && !cumpleHabito(cafe, 3) && cumpleHabito(mov, 1) && !cumpleHabito(mov, 0) && !cumpleHabito(pasos, null), 'se cumple al llegar, al no pasarse o al marcarlo');
  check(fraccionHabito(pasos, 4000) === 0.5 && fraccionHabito(pasos, 12000) === 1 && fraccionHabito(cafe, 1) === 1, 'el anillo se llena con lo apuntado frente al objetivo');
  check(textoObjetivo(pasos) === 'Al menos 8000 pasos, 6 días a la semana' && textoObjetivo(cafe) === 'Como mucho 2 cafés al día' && textoObjetivo(mov) === '3 días a la semana', 'texto del objetivo');
  check(textoValor(pasos, 10500) === '10.500 pasos' && textoValor(mov, 1) === 'Hecho' && pasoHabito(pasos) === 500, 'texto de lo apuntado y salto de cada toque');
  // Semana del 19 al 25 de octubre; hoy es sábado 24
  const reg = (fechas, v) => fechas.map((f) => ({ fecha: f, valor: v }));
  const rp = resumenHabito(pasos, [...reg(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'], 9000), { fecha: '2026-10-24', valor: 3000 },
    ...reg(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'], 8500)], '2026-10-24');
  check(rp.semana.cumplidos === 5 && rp.semana.pedidos === 6 && !rp.semana.llega && rp.semana.dias[6].futuro, 'esta semana: 5 de 6 días (el domingo aún no ha llegado)');
  check(rp.rachaDias === 5 && !rp.cumpleHoy && rp.fraccionHoy === 3000 / 8000, 'hoy aún no llega a los pasos: la racha de días (5) no se rompe todavía');
  check(rp.rachaSemanas === 1, 'semanas seguidas llegando: la anterior sí (6 de 6), esta aún no (pero no rompe)');
  check(rp.pct7.pct === 100 && rp.pct7.cumplidos === 6 && rp.pct7.dias === 7 && rp.media7 === 8000, 'hoy, aún sin llegar, no cuenta: en los 7 días anteriores cumplió 6 de los 6 pedidos (100 %), con la media de los días apuntados');
  const rpHecho = resumenHabito(pasos, [...reg(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'], 9000)], '2026-10-24');
  check(rpHecho.pct7.dias === 7 && rpHecho.pct7.cumplidos === 6, 'en cuanto lo cumple, hoy sí cuenta (y la ventana es de hoy hacia atrás)');
  // Revisión independiente: seis días perfectos no pueden salir al 86 % por la mañana (ni saltar el aviso del panel con 3 de 6)
  const siete = reg(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'], 9000);
  check(resumenHabito({ ...pasos, dias_semana: 7 }, siete, '2026-10-24').pct7.pct === 100, 'por la mañana, sin apuntar hoy, una semana perfecta sigue al 100 % (antes salía 86 %)');
  const rm = resumenHabito(mov, reg(['2026-10-13', '2026-10-15', '2026-10-20'], 1), '2026-10-24');
  check(rm.pct30.dias === 12 && rm.pct30.cumplidos === 3, 'el cumplimiento a 30 días cuenta solo desde que existe el hábito (y hoy, sin hacer, aún no)');
  const { decimalesHabito } = await import('../web/src/logica/habitos.js');
  const agua = (unidad) => ({ tipo: 'numero', objetivo: 2, unidad, sentido: 'al_menos', dias_semana: 7 });
  check(pasoHabito(agua('L')) === 0.25 && pasoHabito(agua('litros')) === 0.25 && decimalesHabito(agua('L')) === 2 && decimalesHabito(agua('litros')) === 2,
    'agua en «L» o en «litros»: salta de 0,25 en 0,25 y admite decimales (antes, con «L», los botones no movían nada)');
  check(decimalesHabito(pasos) === 0 && decimalesHabito({ tipo: 'numero', objetivo: 5, unidad: 'raciones' }) === 2 && pasoHabito({ unidad: 'Horas', objetivo: 7 }) === 0.5, 'los pasos, sin decimales; el resto (raciones, horas…), con ellos');
  const cj = cumplimientoHabitos([pasos, { ...mov, creado_en: '2026-10-22T09:00:00Z' }], { p: rp.semana.dias.filter((d) => d.valor != null).map((d) => ({ fecha: d.iso, valor: d.valor })) }, '2026-10-24');
  check(cj.n === 1, 'en el panel solo cuentan los hábitos con al menos una semana de vida');
}

console.log('\nv0.10: temporizador de intervalos');
{
  const { fases, duracionTotal, enCurso, leerIntervalos, textoIntervalos, normalizar } = await import('../web/src/logica/intervalos.js');
  const f = fases({ modo: 'intervalos', rondas: 3, trabajo: 30, descanso: 60 });
  check(f.map((x) => x.tipo).join() === 'preparar,trabajo,descanso,trabajo,descanso,trabajo' && duracionTotal({ modo: 'intervalos', rondas: 3, trabajo: 30, descanso: 60 }) === 10 + 90 + 120, 'intervalos: preparación, trabajo y descanso, sin descanso tras la última ronda');
  check(fases({ modo: 'emom', minutos: 12 }).filter((x) => x.tipo === 'trabajo').length === 12 && fases({ modo: 'emom', minutos: 12, cada: 120 }).filter((x) => x.tipo === 'trabajo').length === 6, 'EMOM 12: doce minutos; cada 2 min, seis rondas');
  check(fases({ modo: 'tabata' }).filter((x) => x.tipo === 'trabajo').length === 8 && duracionTotal({ modo: 'tabata', preparar: 0 }) === 8 * 20 + 7 * 10, 'Tabata: 8 × 20 s / 10 s');
  const e = enCurso(f, 45);
  check(e.fase.tipo === 'trabajo' && e.fase.ronda === 2 - 1 && Math.round(e.quedan) === 0 + 0 || (e.fase.tipo === 'descanso' && e.quedan === 55), 'a los 45 s está en el primer descanso, con 55 s por delante');
  check(enCurso(f, 10000).fin, 'y al pasarse del total, ha terminado');
  check(igual(leerIntervalos('6 × 2 min fuerte con 2 min suave'), normalizar({ modo: 'intervalos', rondas: 6, trabajo: 120, descanso: 120 })), 'lee «6 × 2 min fuerte con 2 min suave»');
  check(igual(leerIntervalos('Bici: 8x30 s / 90 s'), normalizar({ modo: 'intervalos', rondas: 8, trabajo: 30, descanso: 90 })) && igual(leerIntervalos('10x30/30'), normalizar({ modo: 'intervalos', rondas: 10, trabajo: 30, descanso: 30 })), 'lee «8x30 s / 90 s» y «10x30/30»');
  check(leerIntervalos('EMOM 12: 10 kettlebell swings').minutos === 12 && leerIntervalos('E2MOM 20').cada === 120 && leerIntervalos('AMRAP de 15 min').minutos === 15 && leerIntervalos('Tabata en la bici').modo === 'tabata', 'lee EMOM, E2MOM, AMRAP y Tabata');
  check(leerIntervalos('30 min en zona 2 (puedes hablar sin ahogarte)') === null && leerIntervalos('') === null, 'un cardio continuo no es un intervalo');
  check(textoIntervalos({ modo: 'intervalos', rondas: 8, trabajo: 30, descanso: 90 }) === '8 × 30 s / 1:30 min' && textoIntervalos({ modo: 'emom', minutos: 12 }) === 'EMOM 12 min', 'texto corto de la configuración');
  // Revisión independiente: lo que no son intervalos no debe abrir un temporizador (se lee en las sesiones de fuerza)
  const noSon = ['Sentadilla 5x5, descanso 3 min', '4 x 6 con 3 min de descanso', '3 x 10 con 60 s de pausa', '8 × 400 m con 90 s', '10 x 100 m y 30 s', '8 x 400m / 90 s', '4x6/3', 'E4MOM 20'];
  check(noSon.every((x) => leerIntervalos(x) === null), `no confunde series, distancias ni lo que no sabe hacer con intervalos (${noSon.length} casos)`);
  check(igual(leerIntervalos('8 x 1 min fuerte, 1 min suave'), normalizar({ modo: 'intervalos', rondas: 8, trabajo: 60, descanso: 60 }))
    && igual(leerIntervalos('4 x 4 min a 90-95 % FCmax con 3 min de recuperación'), normalizar({ modo: 'intervalos', rondas: 4, trabajo: 240, descanso: 180 }))
    && leerIntervalos('EMOM: 12')?.minutos === 12 && leerIntervalos('Cada 90 s durante 12 min')?.cada === 90
    && igual(leerIntervalos('5 series de 3 min, descanso 2 min'), normalizar({ modo: 'intervalos', rondas: 5, trabajo: 180, descanso: 120 })),
    'y lee «8 x 1 min fuerte, 1 min suave», el 4 × 4 «a 90-95 % FCmax», «EMOM: 12» y «cada 90 s durante 12 min»');
  check(textoIntervalos({ modo: 'emom', minutos: 10, cada: 90 }) === 'Cada 1:30 min: 6 rondas' && fases({ modo: 'emom', minutos: 10, cada: 90 }).filter((x) => x.tipo === 'trabajo').length === 6, 'cada 1:30 durante 10 min se anuncia como lo que es: 6 rondas');
}

console.log('\nv0.10: plan de la semana');
{
  const { queToca, diaPrevistoValido, cuandoDia, repartir, calendarioICS } = await import('../web/src/logica/plan.js');
  const semana = { fecha_inicio: '2026-10-19' };
  const ses = [
    { id: 'a', orden: 1, nombre: 'Torso A', completada: true, dia_previsto: '2026-10-19' },
    { id: 'b', orden: 2, nombre: 'Pierna A', completada: false, dia_previsto: '2026-10-25' },
    { id: 'c', orden: 3, nombre: 'Torso B', completada: false, dia_previsto: null },
  ];
  check(diaPrevistoValido({ dia_previsto: '2026-10-27' }, semana) === null && diaPrevistoValido(ses[1], semana) === '2026-10-25', 'un día fuera de la semana (si el coach la movió) no cuenta');
  const t = queToca(ses, semana, '2026-10-24');
  check(!t.hoy && t.descanso && t.proxima.sesion.id === 'b' && t.siguiente.id === 'b', 'sábado sin nada previsto: «hoy descansas; mañana, Pierna A»');
  const t2 = queToca(ses, semana, '2026-10-25');
  check(t2.hoy?.id === 'b' && !t2.descanso, 'el domingo: «hoy toca Pierna A»');
  const t3 = queToca([{ ...ses[1], dia_previsto: '2026-10-22' }, ses[2]], semana, '2026-10-24');
  check(t3.atrasadas.length === 1 && t3.siguiente.id === 'b' && !t3.descanso, 'una sesión prevista para un día pasado y sin hacer se propone primero');
  check(queToca(ses.map((x) => ({ ...x, dia_previsto: null })), semana, '2026-10-24').siguiente.id === 'b', 'sin plan, como siempre: la primera pendiente');
  check(cuandoDia('2026-10-25', '2026-10-24') === 'mañana' && cuandoDia('2026-10-28', '2026-10-24') === 'el miércoles', '«mañana», «el miércoles»');
  const rep = repartir([{ id: 'x', orden: 1, completada: false }, { id: 'y', orden: 2, completada: false }, { id: 'z', orden: 3, completada: false }], semana, '2026-10-19');
  check(rep.x === '2026-10-19' && rep.y === '2026-10-21' && rep.z === '2026-10-23', 'repartir: tres sesiones en lunes, miércoles y viernes');
  const ics = calendarioICS([{ id: 'b', dia: '2026-10-25', nombre: 'Pierna A; día de sentadilla' }], { hora: '18:30', minutos: 75, avisoMin: 30 });
  check(ics.includes('DTSTART:20261025T183000') && ics.includes('DTEND:20261025T194500') && ics.includes('TRIGGER:-PT30M') && ics.includes('SUMMARY:Entreno: Pierna A\\; día de sentadilla') && ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'calendario .ics: hora local, aviso 30 min antes, texto escapado y líneas de 75 octetos como mucho');
  const largo = 'Pierna ' + '\u{1F4AA}'.repeat(30);
  const ics2 = calendarioICS([{ id: 'e', dia: '2026-10-25', nombre: largo, descripcion: 'Calentar bien\r\nY luego, a por ello\rsin prisa' }]);
  const desplegado = ics2.replace(/\r\n /g, '');
  check(!ics2.includes('\ufffd') && desplegado.includes(`SUMMARY:Entreno: ${largo}`) && ics2.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)
    && new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(ics2)) === ics2,
    'un nombre con emojis se parte entre líneas sin romper ninguno');
  check(desplegado.includes('DESCRIPTION:Calentar bien\\nY luego\\, a por ello\\nsin prisa') && !/[^\n]\r(?!\n)/.test(ics2), 'los saltos de línea de Windows (\\r\\n) o sueltos (\\r) no rompen el archivo');
}

console.log('\nv0.11: nutrición');
{
  const N = await import('../web/src/logica/nutricion.js');
  const { sumarDias } = await import('../web/src/logica/fechas.js');
  const p1 = { id: 'a', desde: '2026-09-07', modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 2100, proteina_g: 130, carbos_g: 240, grasa_g: 60, kcal_descanso: 1900, carbos_descanso_g: 190, grasa_descanso_g: 60 };
  const p2 = { ...p1, id: 'b', desde: '2026-10-12', kcal: 2000, carbos_g: 215, kcal_descanso: 1800, carbos_descanso_g: 165 };
  const p3 = { ...p1, id: 'c', desde: '2026-10-26', kcal: 1900 };
  const planes = [p2, p1, p3];
  check(N.planVigente(planes, '2026-10-24').id === 'b' && N.planVigente(planes, '2026-10-01').id === 'a' && N.planVigente(planes, '2026-09-01') === null && N.planSiguiente(planes, '2026-10-24').id === 'c',
    'el plan de cada día es la última versión que ya ha empezado (y se sabe cuál viene)');
  const oE = N.objetivoDelDia(p2, true), oD = N.objetivoDelDia(p2, false);
  check(oE.kcal === 2000 && oE.carbos === 215 && !oE.descanso && oD.kcal === 1800 && oD.carbos === 165 && oD.proteina === 130 && oD.descanso, 'los días de descanso tienen sus kcal e hidratos; la proteína es la misma');
  check(N.objetivoDelDia({ modo: 'sin_contar' }) === null && N.kcalMediaPlan(p2, 4) === Math.round((2000 * 4 + 1800 * 3) / 7) && N.kcalDeMacros(130, 215, 60) === 1920, 'sin contar no hay cifras; media semanal y kcal de los macros (4/4/9)');
  check(N.evaluarDia({ kcal: 2050, proteina_g: 125 }, oE) === 'si' && N.evaluarDia({ kcal: 2300, proteina_g: 125 }, oE) === 'casi' && N.evaluarDia({ kcal: 2000, proteina_g: 90 }, oE) === 'no'
    && N.evaluarDia({ proteina_g: 120 }, oE) === 'si' && N.evaluarDia(null, oE) === 'sin_dato' && N.evaluarDia({ cumplido: 1 }, null) === 'casi',
    'un día: «bien» con kcal a ±10 % y proteína ≥ 90 %, «cerca» a ±20 %; lo no apuntado no cuenta en contra');
  const regs = [{ fecha: '2026-10-19', kcal: 2010, proteina_g: 128 }, { fecha: '2026-10-20', kcal: 1790, proteina_g: 131 }, { fecha: '2026-10-21', kcal: 2500, proteina_g: 100, completo: false },
    { fecha: '2026-10-24', kcal: 900, proteina_g: 60 }];
  const sem = N.semanaNutricion({ registros: regs, planes, entrenos: new Set(['2026-10-19', '2026-10-24']) }, '2026-10-19', '2026-10-24');
  check(sem.registrados === 4 && sem.transcurridos === 6 && sem.mediaKcal === 1900 && sem.objetivoKcal === 1900 && sem.dias[5].estado === 'en_curso' && sem.dias[1].obj.kcal === 1800,
    'la semana: hoy va «en curso» y, como lo marcado incompleto, no entra en las medias');
  // Gasto: 2300 kcal de gasto, come 2000 → pierde 300/7700 kg al día; sin ruido, sale exacto
  const hoy = '2026-10-24';
  const ingesta = [], pesos = [];
  for (let i = 40; i >= 0; i--) {
    const f = sumarDias(hoy, -i);
    ingesta.push({ fecha: f, kcal: 2000 });
    pesos.push({ fecha: f, kg: 70 - (40 - i) * 300 / 7700 });
  }
  const g = N.gastoAdaptativo({ registros: ingesta, pesos }, hoy);
  check(g.kcal === 2300 && g.margen === 0 && g.fiabilidad === 'alta' && g.ingesta === 2000 && g.kgSemana === -0.27 && g.diasConKcal === 28, `gasto adaptativo: come 2000 y pierde 0,27 kg a la semana → gasta 2300 (${g.kcal})`);
  const g2 = N.gastoAdaptativo({ registros: ingesta.map((r, i) => (i % 4 ? r : { ...r, kcal: 900, completo: false })), pesos }, hoy);
  check(g2.kcal === 2300, 'los días marcados como incompletos no cuentan (no falsean la media hacia abajo)');
  const g3 = N.gastoAdaptativo({ registros: ingesta.slice(-6), pesos: pesos.filter((_, i) => i % 7 === 0) }, hoy);
  check(g3.kcal === null && /días más con las kcal apuntadas/.test(g3.falta) && /pesada/.test(g3.falta), `con pocos datos, no se inventa: dice lo que falta («${g3.falta}»)`);
  const semanasG = N.gastoPorSemanas({ registros: ingesta, pesos }, hoy, 3);
  check(semanasG.length >= 1 && semanasG.every((x) => x.y === 2300), 'y su evolución, semana a semana, para la gráfica');
  // Ajuste: con 2300 de gasto y 70 kg, −0,5 %/sem pide 2300 − 0,35 × 1100 = 1915 kcal
  const plan = { modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 2330, proteina_g: 140, carbos_g: 285, grasa_g: 70 };
  const aj = N.ajusteNutricion({ plan, gasto: g, pesoKg: 70 });
  check(aj.tipo === 'bajar' && aj.delta === -300 && aj.limitado && aj.objetivo === 1920 && aj.nuevo.proteina_g === 140 && aj.nuevo.grasa_g === 70 && aj.nuevo.carbos_g === 210 && aj.nuevo.kcal === N.kcalDeMacros(140, 210, 70),
    'ajuste: baja como mucho 300 kcal de una vez, todo de hidratos (la proteína y la grasa no se tocan)');
  const ajD = N.ajusteNutricion({ plan: { ...plan, kcal: 2000, kcal_descanso: 1800, carbos_g: 185, carbos_descanso_g: 135, grasa_descanso_g: 70 }, gasto: g, pesoKg: 70, diasEntreno: 4 });
  check(ajD.tipo === 'mantener' || (ajD.nuevo.kcal_descanso != null && ajD.nuevo.kcal - ajD.nuevo.kcal_descanso === 200), 'con días de descanso, los dos bajan o suben lo mismo');
  check(N.ajusteNutricion({ plan: { ...plan, kcal: 1950, carbos_g: 172.5 }, gasto: g, pesoKg: 70 }).tipo === 'mantener', 'si el plan ya está a menos de 100 kcal de lo que toca, no se cambia nada');
  check(N.ajusteNutricion({ plan, gasto: { ...g, fiabilidad: 'baja', margen: 400 }, pesoKg: 70 }).tipo === 'esperar' && N.ajusteNutricion({ plan: { ...plan, ritmo_pct: null }, gasto: g, pesoKg: 70 }) === null,
    'con un gasto poco fiable, esperar; sin ritmo en el plan, no hay ajuste');
  const bajo = N.ajusteNutricion({ plan: { ...plan, kcal: 1300, carbos_g: 85, grasa_g: 40, proteina_g: 120 }, gasto: { ...g, kcal: 1400 }, pesoKg: 70 });
  check(bajo.tipo === 'mantener' || bajo.nuevo.kcal >= 1150, 'nunca propone bajar de 1200 kcal');
  const sub = N.ajusteNutricion({ plan: { ...plan, kcal: 1200, carbos_g: 25, grasa_g: 40, proteina_g: 160, fase: 'perder' }, gasto: { ...g, kcal: 1700 }, pesoKg: 60 });
  check(sub.tipo === 'subir' && sub.nuevo.carbos_g >= 0, 'y si se queda corto, sube');
  // Calculadora
  check(N.mifflin({ sexo: 'hombre', edad: 30, altura: 180, peso: 80 }) === 1780 && N.mifflin({ sexo: 'mujer', edad: 30, altura: 165, peso: 62 }) === 1340 && N.mifflin({ peso: 70 }) === null,
    'Mifflin-St Jeor: 10 × peso + 6,25 × altura − 5 × edad + 5 (hombres) o − 161 (mujeres)');
  const pi = N.planInicial({ sexo: 'mujer', edad: 30, altura: 165, peso: 62, actividad: 1.55, fase: 'perder', ritmo: -0.5 });
  check(pi.mantenimiento === 2077 && pi.proteina_g === 125 && pi.grasa_g === 50 && pi.kcal === N.kcalDeMacros(pi.proteina_g, pi.carbos_g, pi.grasa_g) && Math.abs(pi.kcal - 1750) <= 10 && pi.ritmo_pct === -0.5,
    `plan de partida: mantenimiento × ritmo, proteína 2 g/kg en déficit, grasa 0,8 g/kg, el resto hidratos (${pi.kcal} kcal)`);
  check(N.planInicial({ sexo: 'mujer', edad: 30, altura: 165, peso: 62, fase: 'mantener', ritmo: 0, modo: 'kcal_proteina' }).carbos_g === undefined, 'en «kcal y proteína», sin hidratos ni grasa');
  // Avisos del panel
  const pl = [{ desde: '2026-09-01', ritmo_pct: -0.5, modo: 'macros', kcal: 2000 }];
  const av = N.avisosNutricion({ planes: pl, registros: [{ fecha: '2026-10-22' }], ritmoReal: { pctSemana: -0.1, dias: 21 } }, hoy);
  check(av.some((x) => x.tipo === 'nutricion_registro' && /1 día apuntado/.test(x.texto)) && av.some((x) => x.tipo === 'nutricion_ritmo'), 'panel: avisa si registra poco y si el peso se aleja del ritmo (más de 0,25 %/sem)');
  check(N.avisosNutricion({ planes: [{ desde: '2026-10-20', ritmo_pct: -0.5 }], registros: [], ritmoReal: { pctSemana: 0.3, dias: 21 } }, hoy).length === 0 && N.avisosNutricion({ planes: [] }, hoy).length === 0,
    'con un plan recién puesto (o sin plan), nada que avisar');
  check(N.fmtKcal(1950) === '1950' && N.fmtKcal(12000) === '12.000' && N.textoRitmo(-0.5) === 'bajar un 0,5 % del peso a la semana', 'textos: kcal y ritmo en español');
  // Revisión independiente de la v0.11
  const kp = (kcal) => ({ modo: 'kcal_proteina', fase: 'perder', ritmo_pct: -0.5, kcal, proteina_g: 140 });
  const suelo = N.ajusteNutricion({ plan: kp(1150), gasto: { kcal: 1500, margen: 80, fiabilidad: 'alta' }, pesoKg: 80 });
  check(suelo.tipo === 'revisar' && suelo.delta === 0, 'el suelo de 1200 kcal nunca da la vuelta a un ajuste (antes, con el plan en 1150 y que tocaba bajar, proponía subir)');
  const bajoSube = N.ajusteNutricion({ plan: { ...kp(850), proteina_g: 120, ritmo_pct: -0.25 }, gasto: { kcal: 1500, margen: 80, fiabilidad: 'alta' }, pesoKg: 60 });
  check(bajoSube.tipo === 'subir' && bajoSube.delta === 300 && bajoSube.limite === 'cambio' && /como mucho 300/.test(bajoSube.texto), 'y al subir, también como mucho 300 de una vez (y lo dice)');
  const sinHidratos = N.ajusteNutricion({ plan: { modo: 'macros', fase: 'perder', ritmo_pct: -0.5, kcal: 1470, proteina_g: 250, carbos_g: 50, grasa_g: 30 }, gasto: { kcal: 1880, margen: 80, fiabilidad: 'alta' }, pesoKg: 120 });
  check(sinHidratos.tipo === 'revisar' && !sinHidratos.nuevo && /proteína/.test(sinHidratos.texto), 'si al bajar no caben 50 g de hidratos, pide revisar el plan (antes subía la grasa y las kcal)');
  const grande = N.planInicial({ sexo: 'hombre', edad: 35, altura: 180, peso: 140, actividad: 1.4, fase: 'perder', ritmo: -1 });
  const grandeM = N.planInicial({ sexo: 'mujer', edad: 40, altura: 165, peso: 95, actividad: 1.4, fase: 'perder', ritmo: -1 });
  check(grande.pesoReferencia === 81 && grande.proteina_g === 160 && grande.carbos_g >= 50 && grandeM.carbos_g >= 50 && grandeM.kcal >= 1200,
    `con mucho peso, la proteína va por el peso de referencia (IMC 25) y siempre quedan 50 g de hidratos y 1200 kcal (${grande.kcal}: P${grande.proteina_g} H${grande.carbos_g} G${grande.grasa_g})`);
  check(N.diaIncompleto({ kcal: 600 }) && N.diaIncompleto({ kcal: 1100 }, { kcal: 2000 }) && N.diaIncompleto({ kcal: 2000, completo: false }) && !N.diaIncompleto({ kcal: 1500 }, { kcal: 2000 })
    && N.evaluarDia({ kcal: 900, proteina_g: 60 }, oE) === 'incompleto', 'un día con muy pocas kcal parece a medias: ni cuenta ni se pinta como fallado');
  const mitadDias = ingesta.map((r) => (r.fecha.endsWith('5') ? { ...r, kcal: 700 } : r));
  check(N.gastoAdaptativo({ registros: mitadDias, pesos }, hoy).kcal === 2300, 'los días a medias (700 kcal) no hunden el gasto');
  const soloFinal = N.gastoAdaptativo({ registros: ingesta.filter((r) => r.fecha > sumarDias(hoy, -12)), pesos }, hoy);
  check(soloFinal.kcal === null && /repartidos/.test(soloFinal.falta), 'con lo comido solo de los últimos días y el peso de cuatro semanas, no se calcula');
  const pesoViejo = N.gastoAdaptativo({ registros: ingesta, pesos: pesos.filter((p) => p.fecha < sumarDias(hoy, -9)) }, hoy);
  check(pesoViejo.kcal === null && /esta semana/.test(pesoViejo.falta), 'sin una pesada de la última semana, tampoco');
  // Margen: el mismo ruido de ±0,3 kg, alterno (de un día al otro no se arrastra) o en ondas (se arrastra)
  const conRuido = (f) => pesos.map((p, i) => ({ ...p, kg: p.kg + f(i) }));
  const alterno = N.gastoAdaptativo({ registros: ingesta, pesos: conRuido((i) => (i % 2 ? 0.3 : -0.3)) }, hoy);
  const ondas = N.gastoAdaptativo({ registros: ingesta, pesos: conRuido((i) => 0.3 * Math.sin(i / 2.5)) }, hoy);
  check(ondas.margen > alterno.margen, `cuando el peso arrastra el ruido de un día al siguiente (agua), el margen es mayor (${ondas.margen} frente a ${alterno.margen})`);
  check(/^Peso a −0,1 %\/sem \(objetivo −0,5\)$/.test(av.find((x) => x.tipo === 'nutricion_ritmo').texto) && /en los últimos 7/.test(av.find((x) => x.tipo === 'nutricion_registro').texto), 'panel: con signo menos de verdad y «en los últimos 7» días');
}

console.log('\nNotificaciones');
{
  const d = conDefecto(null);
  check(d.hora_tarde === '21:00' && d.desactivados.join() === 'sesion_hecha' && preferenciasValidas(d), 'las preferencias de entrada son las de la base y son válidas');
  const g = conDefecto({ hora_manana: '07:15:00', hora_tarde: '20:00:00', silencio_desde: null, silencio_hasta: null, desactivados: ['habitos'], dia_checkin: '6' });
  check(g.hora_manana === '07:15' && g.silencio_desde === null && g.dia_checkin === 6 && preferenciasValidas(g), 'las horas de la base («07:15:00») se leen en corto');
  check(!preferenciasValidas({ ...d, hora_manana: '13:00' }) && !preferenciasValidas({ ...d, hora_tarde: '23:45' }) && !preferenciasValidas({ ...d, silencio_hasta: null })
    && !preferenciasValidas({ ...d, silencio_desde: '08:00', silencio_hasta: '08:00' }) && !preferenciasValidas({ ...d, desactivados: ['spam'] }) && !preferenciasValidas({ ...d, dia_checkin: 8 }),
    'como la base: mañana de 5 a 12, tarde de 12 a 23:30, «no molestar» completo y distinto, tipos conocidos');
  check(TIPOS_ATLETA.length === 8 && TIPOS_COACH.length === 5 && TIPOS_COACH.every(([t]) => !TIPOS_ATLETA.some(([a]) => a === t)), 'tipos del atleta y del coach, sin repetir');
  check(claveServidor('BFqg_w').length === 4 && claveServidor('BFqg_w')[0] === 4 && claveServidor('BFqg_w')[3] === 0xff, 'la clave VAPID en base64url pasa a bytes');
  check(normalizarB64url('ab+/cd==') === 'ab-_cd', 'las claves del navegador, en base64url sin relleno');
  check(describirDispositivo('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36') === 'Android · Chrome'
    && describirDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1') === 'iPhone · Safari'
    && describirDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0') === 'Windows · Edge'
    && describirDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0') === 'Mac · Firefox', 'cada móvil u ordenador con un nombre reconocible');
  const base = { vapid: 'B', sw: true, push: true, notificaciones: true };
  check(soportePush({ ...base }) === 'ok' && soportePush({ ...base, demo: true }) === 'demo' && soportePush({ ...base, vapid: '' }) === 'sin_configurar'
    && soportePush({ ...base, ios: true }) === 'ios_instalar' && soportePush({ ...base, ios: true, instalada: true }) === 'ok'
    && soportePush({ ...base, push: false }) === 'no_soportado' && soportePush({ ...base, permiso: 'denied' }) === 'bloqueado',
    'se sabe si se pueden activar: demo, sin configurar, iPhone sin instalar, navegador sin push o permiso bloqueado');
  check(esIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5) && !esIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'un iPad que se presenta como Mac también es iOS');
  const ahora = new Date(2026, 9, 24, 22, 0);
  check(momentoNotificacion(new Date(2026, 9, 24, 21, 5).toISOString(), ahora) === 'hoy, 21:05' && momentoNotificacion(new Date(2026, 9, 23, 9, 30).toISOString(), ahora) === 'ayer, 9:30'
    && /^mié 21 oct, 8:00$/.test(momentoNotificacion(new Date(2026, 9, 21, 8, 0).toISOString(), ahora)), 'la hora de cada una: «hoy, 21:05», «ayer, 9:30», «mié 21 oct, 8:00»');
  check(Object.keys(PREFERENCIAS_DEFECTO).length === 7, 'siete preferencias por cuenta');
}

console.log('\nCuestionario inicial');
{
  // ACSM 2015 (Riebe y cols.): ejercicio habitual × enfermedad conocida × síntomas
  check(resultadoCribado({ activo: false, enfermedad: false, sintomas: [] }) === 'sin_valoracion' && resultadoCribado({ activo: true, enfermedad: false, sintomas: [] }) === 'sin_valoracion',
    'sin enfermedad ni síntomas, no hace falta valoración médica (haga ejercicio o no)');
  check(resultadoCribado({ activo: true, enfermedad: true, sintomas: [] }) === 'valorar_antes_vigoroso' && resultadoCribado({ activo: false, enfermedad: true, sintomas: [] }) === 'valorar_antes',
    'con enfermedad conocida sin síntomas: si ya entrena, valoración antes de la intensidad vigorosa; si no, antes de empezar');
  check(resultadoCribado({ activo: true, enfermedad: false, sintomas: ['mareo'] }) === 'parar_y_valorar' && resultadoCribado({ activo: false, enfermedad: true, sintomas: ['dolor_pecho'] }) === 'valorar_antes',
    'con síntomas: si entrena, parar y que le valoren; si no, valoración antes de empezar');
  check(resultadoCribado({ activo: true, enfermedad: null, sintomas: [] }) === null && resultadoCribado({}) === null, 'sin las tres respuestas no hay recomendación');
  check(Object.keys(MENSAJE_ATLETA).length === 4 && Object.keys(RESULTADO_COACH).length === 4 && /112/.test(MENSAJE_ATLETA.parar_y_valorar), 'un mensaje para cada resultado (y el 112 si hay síntomas)');
  check(SINTOMAS.length === 9 && OTRAS.length === 5, 'los nueve signos y síntomas de la ACSM y cinco situaciones más');
  const hecho = { completado_en: '2026-10-01T10:00:00Z', revisado_en: null };
  check(avisoCuestionario({ ...hecho, resultado: 'sin_valoracion', otras: [] }) === null && avisoCuestionario(null) === null
    && avisoCuestionario({ ...hecho, resultado: 'parar_y_valorar', revisado_en: '2026-10-02' }) === null && avisoCuestionario({ otras: ['medicacion'], completado_en: null }) === null,
    'sin nada que revisar (o ya revisado), el panel no avisa');
  check(avisoCuestionario({ resultado: 'parar_y_valorar', completado_en: null, revisado_en: null })?.nivel === 'alerta',
    'pero si lo de salud ya está guardado, avisa aunque aún no lo haya enviado (síntomas entrenando: lo primero del panel)');
  const av1 = avisoCuestionario({ ...hecho, resultado: 'parar_y_valorar', otras: [] });
  const av2 = avisoCuestionario({ ...hecho, resultado: 'valorar_antes_vigoroso', otras: [] });
  const av3 = avisoCuestionario({ ...hecho, resultado: 'sin_valoracion', otras: ['medicacion'] });
  check(av1.nivel === 'alerta' && /síntomas/.test(av1.texto) && av2.nivel === 'info' && /vigorosa/.test(av2.texto) && av3.nivel === 'info' && /revisa lo de salud/.test(av3.texto),
    'avisa de lo que hay que revisar, sin decir en el panel qué enfermedad o medicación es');
  check(resumenCuestionario({ objetivo: 'fuerza', dias_semana: 4, minutos_sesion: 60, lugar: 'casa' }) === 'Ganar fuerza, 4 días × 60 min, en casa' && resumenCuestionario({ dias_semana: 1 }) === '1 día',
    'resumen de una línea para la ficha');
  check(objetivosDe({ objetivo: 'fuerza' }).join() === 'fuerza' && objetivosDe({ objetivo: 'fuerza', objetivos: ['fuerza', 'perder_grasa'] }).join() === 'fuerza,perder_grasa' && objetivosDe(null).length === 0,
    'v0.20: sus objetivos, también en un cuestionario de antes (solo «objetivo»)');
  check(textoObjetivos({ objetivos: ['fuerza', 'perder_grasa', 'salud'] }) === 'Ganar fuerza, perder grasa y salud y bienestar'
    && resumenCuestionario({ objetivo: 'fuerza', objetivos: ['fuerza', 'perder_grasa'], dias_semana: 3 }) === 'Ganar fuerza y perder grasa, 3 días',
    'y en una línea: «Ganar fuerza y perder grasa»');
  const lo = limpiarCuestionario({ objetivos: ['perder_grasa', 'fuerza', 'perder_grasa', 'magia'] });
  check(lo.objetivos.join() === 'perder_grasa,fuerza' && lo.objetivo === 'perder_grasa' && limpiarCuestionario({ objetivos: [] }).objetivos === null,
    'al guardar varios: sin repetidos ni valores raros, y el primero como principal');
  check(pasosHechos({ objetivos: ['salud'] }).objetivo && !pasosHechos({ objetivos: null }).objetivo, 'el paso del objetivo cuenta con la lista');
  const l = limpiarCuestionario({ objetivo: '', objetivo_detalle: '  Quiero\n  una dominada ', dias_semana: '4', enfermedad: false, enfermedad_detalle: 'nada', otras: ['medicacion', 'medicacion'],
    medicacion_detalle: ' Enalapril ', material: ['barra', 'barra', 'banco'], lesiones: [{ zona: 'rodilla', limita: '5', nota: '  ' }, { limita: 1 }] });
  check(l.objetivo === null && l.objetivo_detalle === 'Quiero una dominada' && l.dias_semana === 4 && l.enfermedad_detalle === null && l.otras.join() === 'medicacion'
    && l.medicacion_detalle === 'Enalapril' && l.material.join() === 'barra,banco' && igual(l.lesiones, [{ zona: 'rodilla', limita: 2 }]) && !('alergias' in l),
    'se guarda limpio: sin vacíos, sin repetidos, el detalle de la enfermedad solo si la hay y solo lo que viene');
  check(igual(Object.values(pasosHechos(null)), [false, false, false, false, false])
    && igual(pasosHechos({ objetivo: 'salud', experiencia: 'ninguna', dias_semana: 3, minutos_sesion: 45, lugar: 'casa', activo: false, enfermedad: false, sintomas: [], lesiones: [] }), { objetivo: true, tiempo: true, lugar: true, salud: true, lesiones: true }),
    'se sabe qué pasos tiene hechos');
}

console.log('\nCheck-in a medida');
{
  check(pregunta(null, 'peso') && pregunta({ checkin_apartados: null }, 'medidas') && pregunta({ checkin_apartados: ['peso'] }, 'peso') && !pregunta({ checkin_apartados: ['peso'] }, 'reloj'),
    'sin elegir nada, se pregunta todo; si el coach elige, solo eso');
  const P = [
    { id: 'a', atleta_id: null, tipo: 'escala', texto: 'Estrés', orden: 0, creado_en: '2026-09-01' },
    { id: 'b', atleta_id: 'x', tipo: 'numero', texto: 'Horas de pie', unidad: 'h', orden: 1, creado_en: '2026-09-02' },
    { id: 'c', atleta_id: 'x', tipo: 'texto', texto: 'Lumbar', orden: 1, creado_en: '2026-09-01', activa: false },
    { id: 'd', atleta_id: 'y', tipo: 'si_no', texto: '¿Cenas tarde?', orden: 0, creado_en: '2026-09-01' },
  ];
  check(preguntasDe(P, 'x').map((p) => p.id).join() === 'a,b' && preguntasDe(P, 'x', { archivadas: true }).map((p) => p.id).join() === 'a,c,b',
    'las de ese atleta y las de todos, en orden; las archivadas solo si se piden');
  check(respuestaValida(P[0], 4) && !respuestaValida(P[0], 6) && !respuestaValida(P[0], 3.5) && respuestaValida(P[1], 7.25) && !respuestaValida(P[1], 7.255) && !respuestaValida(P[1], -1)
    && respuestaValida(P[2], 'Bien') && !respuestaValida(P[2], '\u200b') && respuestaValida(P[3], false) && !respuestaValida(P[3], 'no') && !respuestaValida(null, 1),
    'cada respuesta con la forma de su pregunta, como en la base');
  check(igual(limpiarRespuestas(P, { a: '4', b: '7,555', c: '  Mejor  ', d: true, z: 1 }), { a: 4, b: 7.56, c: 'Mejor', d: true }) && limpiarRespuestas(P, { a: '', c: '   ' }) === null,
    'se guardan las contestadas, con los números de los campos como números (y dos decimales)');
  check(limpiarRespuestas(P, { b: '8.000' }).b === 8000 && limpiarRespuestas(P, { b: '12.500,5' }).b === 12500.5 && limpiarRespuestas(P, { b: '8 000' }).b === 8000,
    'los números se leen como en el resto de la app («8.000» son ocho mil)');
  check(respuestasNoValidas(P, { a: '9', b: 'mucho', c: '  ', d: true }).map((p) => p.id).join() === 'a,b' && !respuestasNoValidas(P, { b: '7,5' }).length,
    'lo escrito que no vale se dice (no se pierde en silencio); lo vacío no es un error');
  check(textoRespuesta(P[0], 4) === '4/5' && textoRespuesta(P[1], 7.5) === '7,5 h' && textoRespuesta(P[3], true) === 'Sí' && textoRespuesta(P[2], null) === '—', 'cada respuesta, legible');
  const s = serieRespuestas([{ semana_inicio: '2026-10-12', respuestas: { a: 3 } }, { semana_inicio: '2026-10-05', respuestas: { a: 4 } }, { semana_inicio: '2026-09-28', respuestas: null }], P[0]);
  check(igual(s, [{ iso: '2026-10-05', valor: 4 }, { iso: '2026-10-12', valor: 3 }]), 'la serie de una pregunta para su gráfica, de la más antigua a la última');
}

console.log('\nLíneas y ángulos sobre el vídeo');
{
  check(grados([[0.5, 0.5], [0.5, 0], [1, 0.5]]) === 90 && grados([[0, 0], [1, 0], [1, 0]]) === 0 && grados([[0.5, 0.5], [0, 0.5], [1, 0.5]]) === 180 && grados([[0, 0], [0, 0], [1, 1]]) === null,
    'los grados del ángulo en el vértice (90, 0, 180; sin extremos, nada)');
  check(grados([[0.5, 0.5], [0.5, 0], [1, 0.5]], 2) === 90 && grados([[0, 0], [1, 0], [1, 1]], 2) === 27, 'con la proporción real de la imagen (un vídeo apaisado no deforma el ángulo)');
  const ok1 = { t: 2.4, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }, { tipo: 'angulo', p: [[0.5, 0.5], [0.5, 0], [1, 0.5]] }] };
  check(dibujoValido(ok1) && !dibujoValido({ t: 1, formas: [] }) && !dibujoValido({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [2, 1]] }] }) && !dibujoValido({ t: 1, formas: [{ tipo: 'angulo', p: [[0, 0], [1, 1]] }] })
    && !dibujoValido({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], color: 1 }] }) && !dibujoValido(null), 'la forma exacta, como la base');
  const l = limpiarDibujo(2.4449, [{ tipo: 'linea', p: [[0.12345, 1.2], [-0.1, 0.5]] }]);
  check(l.t === 2.4 && igual(l.p?.[0] || l.formas[0].p, [[0.123, 1], [0, 0.5]]) && limpiarDibujo(1, []) === null, 'se guarda en décimas y con 3 decimales, dentro de la imagen');
  check(igual(rectImagen(400, 300, 1080, 1920), { x: 115.625, y: 0, w: 168.75, h: 300 }) && igual(rectImagen(400, 300, 400, 300), { x: 0, y: 0, w: 400, h: 300 }),
    'el rectángulo de la imagen dentro del vídeo (con bandas a los lados si es vertical)');
  check(describirDibujo(ok1) === 'una línea y un ángulo de 90°' && describirDibujo({ formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }, { tipo: 'linea', p: [[0, 0], [1, 1]] }] }) === '2 líneas', 'descrito en palabras');
}

console.log('\nTu día');
{
  const hoy = '2026-10-21'; // miércoles
  const semana = { id: 'w', fecha_inicio: '2026-10-19', numero: 1 };
  const ses = [{ id: 's1', nombre: 'Torso A', completada: true, fecha_realizada: '2026-10-19', dia_previsto: '2026-10-19' }, { id: 's2', nombre: 'Pierna A', completada: false, dia_previsto: '2026-10-21' }, { id: 's3', nombre: 'Torso B', completada: false, dia_previsto: '2026-10-23' }];
  const hab = (cumple, dias = 7) => ({ habito: { nombre: 'Pasos', dias_semana: dias }, cumpleHoy: cumple, semana: { llega: false } });
  const d1 = tuDia({ semana, sesiones: ses, pesoHoy: false, habitos: [hab(true), hab(false)], nutricion: { plan: { modo: 'macros' }, hoy: null }, checkin: { hecho: false, pendiente: true }, cuestionario: { pendiente: true } }, hoy);
  check(d1.map((x) => `${x.id}:${x.estado}`).join() === 'cuestionario:toca,sesion:toca,habitos:toca,nutricion:luego,peso:luego,checkin:toca',
    'lo que toca hoy, en orden: cuestionario pedido, la sesión de hoy, hábitos a medias; nutrición y peso para luego; el check-in pendiente');
  check(d1.find((x) => x.id === 'sesion').texto === 'Pierna A' && d1.find((x) => x.id === 'sesion').detalle === 'Hoy toca entrenar' && d1.find((x) => x.id === 'habitos').detalle === '1 de 2 hechos hoy', 'con sus textos');
  const d2 = tuDia({ semana, sesiones: ses.map((s) => (s.id === 's2' ? { ...s, completada: true, fecha_realizada: hoy } : s)), pesoHoy: true, habitos: [hab(true)], nutricion: { plan: { modo: 'sin_contar' }, hoy: { completo: true } }, checkin: null, cuestionario: null }, hoy);
  check(d2.every((x) => x.estado === 'hecho') && resumenDia(d2).todo && d2[0].detalle === 'Sesión hecha', 'con todo hecho, todo en verde y «Todo hecho»');
  const d3 = tuDia({ semana, sesiones: ses.map((s) => (s.id === 's2' ? { ...s, completada: true, fecha_realizada: '2026-10-21' } : s)), pesoHoy: null, habitos: null, nutricion: null, checkin: null, cuestionario: { pendiente: false } }, '2026-10-22');
  check(d3.length === 1 && d3[0].estado === 'descanso' && d3[0].detalle === 'La próxima, Torso B', 'sin consentimiento de salud, solo la sesión; un día sin sesión prevista es descanso');
  const d4 = tuDia({ semana, sesiones: ses, pesoHoy: null, habitos: null, nutricion: null, checkin: null, cuestionario: null }, '2026-10-24');
  check(d4[0].estado === 'toca' && /prevista/.test(d4[0].detalle), 'una sesión que se quedó atrás vuelve a tocar');
  check(resumenDia(d3) === null && resumenDia(d1).hechas === 0 && resumenDia(d1).pendientes >= 3, 'el resumen cuenta lo que hay que hacer (el descanso no cuenta)');
}

console.log('\nCardio (v0.17)');
{
  check(cardioValido({ modalidad: 'carrera', minutos: 30 }) && cardioValido({ modalidad: 'bici', km: 20.5, esfuerzo: 6, nota: 'Llano' }) && cardioValido({ modalidad: 'remo', minutos: 20, km: 4 }), 'pautas válidas: modalidad y minutos o km, con esfuerzo y nota opcionales');
  check(!cardioValido({ modalidad: 'carrera' }) && !cardioValido({ minutos: 30 }) && !cardioValido({ modalidad: 'patinete', minutos: 30 }) && !cardioValido({ modalidad: 'bici', minutos: 30.5 })
    && !cardioValido({ modalidad: 'bici', minutos: 0 }) && !cardioValido({ modalidad: 'bici', km: 0 }) && !cardioValido({ modalidad: 'bici', km: 201 }) && !cardioValido({ modalidad: 'bici', minutos: 30, esfuerzo: 11 })
    && !cardioValido({ modalidad: 'bici', minutos: 30, nota: '' }) && !cardioValido({ modalidad: 'bici', minutos: 30, fc: 150 }) && !cardioValido(null) && !cardioValido([]) && !cardioValido({ modalidad: 'bici', minutos: '30' }),
    'y no válidas: sin minutos ni km, modalidad desconocida, decimales o ceros, esfuerzo fuera de 1–10, nota vacía, campos de más, textos en vez de números');
  check(cardioHechoValido({ modalidad: 'carrera', minutos: 32, km: 5.2 }) && cardioHechoValido({ modalidad: 'andar', minutos: 45 }) && !cardioHechoValido({ modalidad: 'carrera' }) && !cardioHechoValido({ modalidad: 'carrera', minutos: 32, fc: 1 }) && !cardioHechoValido({ modalidad: 'carrera', minutos: 32, km: 0 }), 'lo hecho: modalidad y minutos enteros; km opcional y mayor que 0');
  const l1 = limpiarCardio({ modalidad: 'carrera', minutos: '30', km: '', esfuerzo: '6', nota: '  Llano  ' });
  check(igual(l1, { pauta: { modalidad: 'carrera', minutos: 30, esfuerzo: 6, nota: 'Llano' }, error: null }), 'del editor sale la pauta limpia (textos a números, nota recortada, sin claves vacías)');
  check(igual(limpiarCardio({ modalidad: 'bici', minutos: '', km: '20,5' }).pauta, { modalidad: 'bici', km: 20.5 }), 'acepta la coma decimal en los kilómetros');
  check(limpiarCardio({ modalidad: 'bici' }).pauta === null && limpiarCardio({ modalidad: 'bici' }).error === null, 'todo vacío es «sin pauta», no un error');
  check(/minutos o los kil/.test(limpiarCardio({ modalidad: 'bici', nota: 'x' }).error) && /1 a 600/.test(limpiarCardio({ modalidad: 'bici', minutos: '700' }).error) && /0,1 a 200/.test(limpiarCardio({ modalidad: 'bici', km: '300' }).error), 'los errores dicen qué falta, en palabras');
  check(igual(limpiarCardioHecho({ modalidad: 'carrera', minutos: 32, km: '5.25' }), { modalidad: 'carrera', minutos: 32, km: 5.25 }) && igual(limpiarCardioHecho({ modalidad: 'carrera', minutos: 32, km: 0 }), { modalidad: 'carrera', minutos: 32 }) && limpiarCardioHecho({ modalidad: 'carrera', minutos: null }) === null, 'lo hecho se limpia igual: km a 0 es «sin km»; sin minutos no vale');
  check(textoCardio({ modalidad: 'carrera', minutos: 30, esfuerzo: 6 }) === '30 min de correr a esfuerzo 6' && textoCardio({ modalidad: 'bici', km: 20 }) === '20 km de bici' && textoCardio({ modalidad: 'remo', minutos: 20, km: 4.5 }) === '20 min y 4,5 km de remo', 'la pauta en palabras');
  check(textoCardioHecho({ modalidad: 'carrera', minutos: 32, km: 5.2 }) === '32 min, 5,2 km (6:09 min/km)' && textoCardioHecho({ modalidad: 'andar', minutos: 45 }) === '45 min', 'lo hecho en palabras, con el ritmo si hay km');
  check(textoCardioHecho({ modalidad: 'bici', minutos: 60, km: 30 }) === '60 min, 30 km (30 km/h)', 'en bici, el texto de lo hecho lleva km/h, no min/km');
  check(!cardioValido({ modalidad: 'constructor', minutos: 30 }) && !cardioHechoValido({ modalidad: 'toString', minutos: 30 }), 'una «modalidad» que solo existe como propiedad heredada de los objetos no cuela');
  check(cardioHechoDe({ completada: true, tipo: 'cardio', duracion_min: 25, cardio_hecho: null })?.minutos === 25 && cardioHechoDe({ completada: false, tipo: 'cardio', duracion_min: 25 }) === null
    && cardioHechoDe({ completada: true, tipo: 'fuerza', duracion_min: 60 }) === null && cardioHechoDe({ completada: true, tipo: 'fuerza', cardio_hecho: { modalidad: 'remo', minutos: 10 } })?.modalidad === 'remo',
    'la misma regla para Progreso y «Tu semana»: el registro, o la duración de una sesión de cardio antigua; nunca una de fuerza sin registro ni una pendiente');
  check(ritmo(30, 5) === '6:00 min/km' && ritmo(60, 20, 'bici') === '20 km/h' && ritmo(30, 0) === '' && ritmo(61, 10) === '6:06 min/km', 'ritmo en min/km al correr o andar y en km/h en bici y demás');
  check(/frases largas/.test(palabrasEsfuerzo(3)) && /cantar/.test(palabrasEsfuerzo(6)) && /palabras sueltas/.test(palabrasEsfuerzo(8)) && /no puedes hablar/.test(palabrasEsfuerzo(10)) && palabrasEsfuerzo(null) === '', 'el esfuerzo objetivo, con la prueba del habla');
  const lunes = ['2026-10-05', '2026-10-12', '2026-10-19'];
  const ses = [
    { completada: true, fecha_realizada: '2026-10-07', tipo: 'cardio', cardio_hecho: { modalidad: 'carrera', minutos: 30, km: 5 } },
    { completada: true, fecha_realizada: '2026-10-10', tipo: 'fuerza', cardio_hecho: { modalidad: 'bici', minutos: 20, km: 7.5 } },
    { completada: true, fecha_realizada: '2026-10-11', tipo: 'cardio', cardio_hecho: null, duracion_min: 25 },
    { completada: false, fecha_realizada: null, tipo: 'cardio', cardio_hecho: { modalidad: 'carrera', minutos: 30 } },
    { completada: true, fecha_realizada: '2026-10-20', tipo: 'fuerza', cardio_hecho: null, duracion_min: 60 },
    { completada: true, fecha_realizada: '2026-10-04', tipo: 'cardio', cardio_hecho: { modalidad: 'carrera', minutos: 99 } },
  ];
  check(igual(cardioPorSemana(ses, lunes), [{ lunes: '2026-10-05', minutos: 75, km: 12.5, sesiones: 3 }, { lunes: '2026-10-12', minutos: 0, km: 0, sesiones: 0 }, { lunes: '2026-10-19', minutos: 0, km: 0, sesiones: 0 }]),
    'por semana: suma lo hecho (también en sesiones de fuerza con cardio al final y las de cardio antiguas solo con duración); una sesión de fuerza sin cardio no cuenta, ni lo pendiente, ni lo de fuera del rango');
}

console.log('\nRegistro de errores: qué se apunta (v0.21)');
{
  const { instalarRegistro, reportarError } = await import('../web/src/registro-errores.js');
  const llegan = [];
  instalarRegistro((d) => llegan.push(d), '0.21');
  reportarError(new TypeError('x is undefined'), 'carga');
  reportarError(new TypeError('x is undefined'), 'carga');
  reportarError(new TypeError('Failed to fetch'), 'carga');
  reportarError(Object.assign(new Error('Sin conexión'), { sinConexion: true }), 'carga');
  reportarError({ name: 'AbortError', message: 'aborted' }, 'carga');
  reportarError(new Error('ResizeObserver loop limit exceeded'), 'error');
  for (let i = 0; i < 30; i++) reportarError(new Error(`otro ${i}`), 'error');
  await new Promise((r) => setTimeout(r, 20));
  check(llegan[0]?.mensaje === 'x is undefined' && llegan[0].version === '0.21' && llegan[0].pantalla.startsWith('carga') && /TypeError/.test(llegan[0].detalle || ''),
    'un error de verdad se apunta con su mensaje, la pantalla, la pila y la versión');
  check(!llegan.some((d) => /Failed to fetch|Sin conexión|aborted|ResizeObserver/.test(d.mensaje)), 'los de red, sin conexión, cancelados o ruido del navegador, no');
  check(llegan.filter((d) => d.mensaje === 'x is undefined').length === 1 && llegan.length === 15, 'cada uno una vez por sesión, y como mucho 15');
}

console.log('\nNivel y servicio (v0.22)');
{
  check(modoCarga('novato', 'baja') === 'kg' && modoCarga('intermedio', 'alta') === 'kg' && modoCarga('intermedio', 'media') === 'rpe' && modoCarga('intermedio', 'muy_baja') === 'rpe'
    && modoCarga('avanzado', 'alta') === 'rpe' && modoCarga(null, 'alta') === null && NIVELES.length === 4,
    'novato con kg en todo; intermedio con kg solo en los de prioridad alta; avanzado a RPE; sin nivel, libre');
  check(modoCarga('novato_intermedio', 'alta') === 'kg' && modoCarga('novato_intermedio', 'media') === 'kg' && modoCarga('novato_intermedio', 'baja') === 'rpe' && modoCarga('novato_intermedio', 'muy_baja') === 'rpe'
    && NIVELES.map(([v]) => v).join() === 'novato,novato_intermedio,intermedio,avanzado',
    'novato/intermedio: kg en los obligatorios y los muy importantes (multiarticulares complementarios), RPE en accesorios y prescindibles; los cuatro niveles en orden');
  const pautas = [{ prioridad: 'alta', carga_sugerida_kg: 60 }, { prioridad: 'media', rpe_objetivo: 8 }];
  check(JSON.stringify(columnasEditor(null, pautas)) === '{"rir":true,"rpe":true,"kg":true}', 'sin nivel, el editor enseña todas las columnas');
  check(JSON.stringify(columnasEditor('intermedio', pautas)) === '{"rir":false,"rpe":true,"kg":true}' && JSON.stringify(columnasEditor('novato', [{ prioridad: 'media' }])) === '{"rir":false,"rpe":false,"kg":true}'
    && JSON.stringify(columnasEditor('avanzado', [{ prioridad: 'alta' }])) === '{"rir":false,"rpe":true,"kg":false}', 'con nivel, solo las columnas que usa');
  check(columnasEditor('novato', [{ prioridad: 'media', rpe_objetivo: 8, rir_objetivo: 2 }]).rpe && columnasEditor('novato', [{ prioridad: 'media', rir_objetivo: 2 }]).rir
    && columnasEditor('avanzado', [{ prioridad: 'alta', carga_sugerida_kg: 50 }]).kg, 'pero nunca esconde una columna con algo puesto');
  const ultimas = { series: [{ numero: 1, kg: 60, reps: 8 }, { numero: 2, kg: '62.5', reps: 8 }, { numero: 3, kg: 0, reps: 10 }] };
  check(pesoAnterior(ultimas, 1) === 60 && pesoAnterior(ultimas, 2) === 62.5 && pesoAnterior(ultimas, 3) === null && pesoAnterior(ultimas, 5) === null && pesoAnterior({ series: ultimas.series.slice(0, 2) }, 4) === 62.5
    && pesoAnterior(null, 1) === null && pesoAnterior({ series: [{ numero: 2, kg: 40 }] }, 1) === null,
    'el peso anterior es el de esa misma serie (sin peso, nada; series de más, el de la última que hizo)');
  check(conNutricion({}) && conNutricion({ nutricion: true }) && !conNutricion({ nutricion: false }) && conNutricion(null) && textoServicio({ nutricion: false }) === 'Solo entrenamiento',
    'con nutrición salvo que el coach diga lo contrario (una base sin la 018 sigue como siempre)');
}

console.log('\nPreparar las semanas siguientes (v0.23)');
{
  const banca = { carga_sugerida_kg: 60, series: 3, reps_min: 6, reps_max: 8, rpe_objetivo: null, rir_objetivo: 2, backoff_pct: null };
  const curl = { carga_sugerida_kg: 12, series: 3, reps_min: 10, reps_max: 12, rpe_objetivo: null, rir_objetivo: null };
  const remo = { carga_sugerida_kg: null, series: 3, reps_min: 10, reps_max: 12, rpe_objetivo: 9.5, rir_objetivo: null };
  const def = { kg: 'salto', rpe: 0.5, rir: 0, reps: 0 };
  check(progresarPauta(banca, def, { nombre: 'Press banca' }).carga_sugerida_kg === 62.5 && progresarPauta(curl, def, { nombre: 'Curl con mancuernas' }).carga_sugerida_kg === 14
    && progresarPauta({ ...curl, carga_sugerida_kg: 70 }, def, { nombre: 'Prensa' }).carga_sugerida_kg === 75, 'un salto por semana según el ejercicio: barra +2,5, mancuernas +2, máquina pesada +5');
  check(progresarPauta(remo, def).rpe_objetivo === 10 && progresarPauta({ ...remo, rpe_objetivo: 10 }, def).rpe_objetivo === 10 && progresarPauta(remo, def).carga_sugerida_kg === null,
    'el RPE sube medio punto sin pasar de 10, y donde no hay kilos no aparecen');
  check(progresarPauta(banca, { kg: 'igual', rpe: 0, rir: -1, reps: 1 }).carga_sugerida_kg === 60 && progresarPauta(banca, { kg: 'igual', rir: -1, reps: 1 }).rir_objetivo === 1
    && progresarPauta(banca, { kg: 'igual', reps: 1 }).reps_max === 9 && progresarPauta({ ...banca, rir_objetivo: 0 }, { kg: 'igual', rir: -1 }).rir_objetivo === 0, 'kilos iguales, RIR y repeticiones a mano (el RIR no baja de 0)');
  const d = progresarPauta(banca, def, { nombre: 'Press banca', descarga: true });
  check(d.carga_sugerida_kg === 55 && d.series === 2 && d.rir_objetivo === 3 && d.reps_max === 8, 'descarga: un 10 % menos de kilos al salto del ejercicio (60 → 55), una serie menos y RIR 1 más');
  const d2 = progresarPauta({ ...remo, series: 1, rpe_objetivo: 5.5 }, def, { descarga: true });
  const d3 = progresarPauta({ ...banca, series: 2, backoff_pct: 10 }, def, { nombre: 'Press banca', descarga: true });
  check(d2.series === 1 && d2.rpe_objetivo === 5 && d3.series === 2, 'nunca menos de una serie (dos con top + back-off) ni RPE por debajo de 5');
  const mixto = { carga_sugerida_kg: 60, series: 3, rpe_objetivo: 7, rir_objetivo: null };
  const m1 = progresarPauta(mixto, def, { nombre: 'Press banca' });
  check(m1.carga_sugerida_kg === 62.5 && m1.rpe_objetivo === 7 && progresarPauta(mixto, { ...def, kg: 'igual' }).rpe_objetivo === 7.5, 'lo que sube de kilos no sube además el RPE (60 kg @7 → 62,5 kg @7); con los kilos iguales, sí');
  const ligera = (kg, nombre) => progresarPauta({ carga_sugerida_kg: kg, series: 3 }, def, { nombre, descarga: true }).carga_sugerida_kg;
  check(ligera(2, 'Elevaciones laterales con mancuernas') === 2 && ligera(4, 'Curl con mancuernas') === 3.5 && ligera(2.5, 'Face pull en polea') === 2.5 && ligera(100, 'Sentadilla') === 90,
    'la descarga nunca deja una carga ligera a 0 ni la baja más de un 20 % (2 → 2, 4 → 3,5; 100 → 90)');
  check(progresarPauta({ rpe_objetivo: 4, series: 3 }, def, { descarga: true }).rpe_objetivo === 4, 'ni sube un RPE que ya era bajo');
  check(progresarPauta(banca, opcionesDe({ kg: 2.5 })).carga_sugerida_kg === 62.5 && progresarPauta(banca, opcionesDe({})).carga_sugerida_kg === 60, 'lo de antes («Duplicar» con kilos fijos) sigue igual');
}

console.log('\nControl de cobros (v0.24)');
{
  check(sumarMeses('2026-01-31', 1) === '2026-02-28' && sumarMeses('2026-11-15', 3) === '2027-02-15' && sumarMeses('2026-03-31', -1) === '2026-02-28', 'sumar meses, con los meses cortos');
  check(finPeriodo('2026-07-20', 'trimestral') === '2026-10-19' && finPeriodo('2026-11-01', 'mensual') === '2026-11-30' && finPeriodo('2026-01-01', 'anual') === '2026-12-31',
    'el periodo acaba el día antes del mismo día del siguiente (20 jul trimestral → 19 oct)');
  check(importePeriodo({ precio_mes: 75, ciclo: 'trimestral' }) === 225 && importePeriodo({ precio_mes: 49.5, ciclo: 'mensual' }) === 49.5 && importePeriodo(null) === null, 'lo que toca cobrar: precio al mes × meses del periodo');
  const pagos = [{ periodo_desde: '2026-07-20', periodo_hasta: '2026-10-19', importe: 225, estado: 'pagado', fecha_pago: '2026-07-21' }, { periodo_desde: '2026-10-20', periodo_hasta: '2027-01-19', importe: 225, estado: 'pendiente' }];
  const s1 = siguientePeriodo(pagos, { ciclo: 'trimestral', precio_mes: 75 });
  check(s1.desde === '2027-01-20' && s1.hasta === '2027-04-19' && s1.importe === 225 && siguientePeriodo([], { desde: '2026-11-03', ciclo: 'mensual' }).hasta === '2026-12-02', 'el siguiente cobro empieza justo después del último (o cuando empezó a pagar)');
  const r1 = resumenCobros(pagos, '2026-10-27');
  check(r1.pagadoHasta === '2026-10-19' && r1.debe === 225 && r1.estado === 'pendiente', 'pagado hasta el 19 oct y debe 225 € (el periodo ya ha empezado)');
  check(resumenCobros(pagos, '2026-10-15').estado === 'vence_pronto' && resumenCobros(pagos, '2026-10-15').debe === 0 && resumenCobros(pagos.slice(0, 1), '2026-10-25').estado === 'vencido'
    && resumenCobros([{ ...pagos[1], estado: 'retrasado' }], '2026-11-01').estado === 'retrasado' && resumenCobros([], '2026-11-01').estado === 'sin_datos' && resumenCobros(pagos, '2026-08-01').estado === 'al_dia',
    'cada estado: vence esta semana, periodo acabado sin el siguiente, retrasado, sin cobros, al día');
  const a31 = { desde: '2026-01-31', ciclo: 'mensual', precio_mes: 50 };
  const s31 = siguientePeriodo([{ periodo_desde: '2026-01-31', periodo_hasta: '2026-02-27', estado: 'pagado' }, { periodo_desde: '2026-02-28', periodo_hasta: '2026-03-30', estado: 'pagado' }], a31);
  check(s31.desde === '2026-03-31' && s31.hasta === '2026-04-29' && siguientePeriodo([{ periodo_desde: '2026-11-30', periodo_hasta: '2027-02-27' }], { desde: '2026-11-30', ciclo: 'trimestral' }).desde === '2027-02-28'
    && siguientePeriodo([{ periodo_desde: '2026-11-30', periodo_hasta: '2027-02-27' }, { periodo_desde: '2027-02-28', periodo_hasta: '2027-05-29' }], { desde: '2026-11-30', ciclo: 'trimestral' }).desde === '2027-05-30',
    'los periodos cuentan siempre desde el día en que empezó a pagar (un 31 no se queda en 28: 31 ene → 28 feb → 31 mar)');
  check(resumenCobros([{ periodo_desde: '2026-12-01', periodo_hasta: '2026-12-31', importe: 49, estado: 'pendiente' }], '2026-11-20').estado === 'primer_cobro'
    && resumenCobros(pagos, '2026-10-13').estado === 'vence_pronto' && resumenCobros(pagos, '2026-10-12').estado === 'al_dia', 'un atleta nuevo con su primer cobro por llegar no sale «al día»; «vence esta semana» son 7 días');
  check(leerEuros('1.308') === 1308 && leerEuros('1.250,50') === 1250.5 && leerEuros('74,5') === 74.5 && leerEuros('74.50') === 74.5 && leerEuros('2.988 €') === 2988
    && leerEuros('') === null && Number.isNaN(leerEuros('doce')) && Number.isNaN(leerEuros('1,2,3')), 'euros a la española: «1.308» son mil trescientos ocho, no 1,31');
  check(cobradoEnMes(pagos, '2026-07') === 225 && cobradoEnMes(pagos, '2026-10') === 0 && fmtEuros(225) === '225 €' && fmtEuros(74.5) === '74,50 €', 'lo cobrado en un mes, por fecha de pago, en euros');
}

console.log('\nComidas: recetas, recetario y menú (v0.26)');
{
  const I = (l) => JSON.stringify(leerIngrediente(l));
  check(I('60 g de copos de avena') === JSON.stringify({ nombre: 'Copos de avena', cantidad: 60, unidad: 'g' }) && I('2 huevos') === JSON.stringify({ nombre: 'Huevos', cantidad: 2, unidad: 'ud' })
    && I('200ml leche desnatada') === JSON.stringify({ nombre: 'Leche desnatada', cantidad: 200, unidad: 'ml' }) && I('- 30 gr de nueces') === JSON.stringify({ nombre: 'Nueces', cantidad: 30, unidad: 'g' }),
    'ingredientes escritos como en Notion: «60 g de avena», «2 huevos», «200ml leche», «- 30 gr de nueces»');
  check(I('Avena 60 g') === JSON.stringify({ nombre: 'Avena', cantidad: 60, unidad: 'g' }) && I('½ aguacate') === JSON.stringify({ nombre: 'Aguacate', cantidad: 0.5, unidad: 'ud' })
    && I('1/2 cebolla') === JSON.stringify({ nombre: 'Cebolla', cantidad: 0.5, unidad: 'ud' }) && I('Sal al gusto') === JSON.stringify({ nombre: 'Sal al gusto' }) && leerIngrediente('  ') === null,
    'también con la cantidad detrás, fracciones y sin cantidad («sal al gusto»); una línea vacía no es nada');
  check(leerIngrediente('3 tortillas de trigo integrales (120 g)').nombre === 'Tortillas de trigo integrales (120 g)' && leerIngrediente('1 gelatina de proteínas').nombre === 'Gelatina de proteínas'
    && leerIngrediente('1 huevo M (50 g)').nombre === 'Huevo M (50 g)', 'sin unidad, el «de» del nombre se queda («3 tortillas de trigo»)');
  { const soja = leerIngrediente('1 cda (10 ml) de salsa de soja baja en sodio');
    check(soja.nombre === 'Salsa de soja baja en sodio (10 ml)' && soja.cantidad === 1 && soja.unidad === 'cda', 'con un paréntesis tras la unidad («1 cda (10 ml) de salsa de soja»), el paréntesis pasa al final del nombre'); }
  check(leerIngredientes('60 g avena\n\n2 huevos;1 cda aceite').length === 3 && leerIngredientes(Array(50).fill('1 huevo').join('\n')).length === 40, 'varias líneas (o con punto y coma), hasta 40');
  check(escalarCantidad(60, 'g', 1.5) === 90 && escalarCantidad(33, 'g', 1.5) === 50 && escalarCantidad(12, 'g', 1.25) === 15 && escalarCantidad(2, 'ud', 1.25) === 2.5 && escalarCantidad(0.5, 'ud', 0.5) === 0.25,
    'al escalar, gramos de 5 en 5 (de 1 en 1 por debajo de 50) y unidades de media en media');
  check(textoIngrediente({ nombre: 'Copos de avena', cantidad: 60, unidad: 'g' }, 1.5) === '90 g de copos de avena' && textoIngrediente({ nombre: 'Huevos', cantidad: 2, unidad: 'ud' }) === '2 huevos'
    && textoIngrediente({ nombre: 'Pan', cantidad: 2, unidad: 'rebanada' }) === '2 rebanadas de pan' && textoIngrediente({ nombre: 'Aceite', cantidad: 1, unidad: 'cda' }) === '1 cda. de aceite' && textoIngrediente({ nombre: 'Sal al gusto' }) === 'Sal al gusto',
    'el ingrediente en palabras, escalado y con el plural de la unidad');
  const xs = leerIngredientes('60 g de avena\n2 huevos\nSal');
  check(igual(leerIngredientes(ingredientesATexto(xs)), xs), 'pasar los ingredientes a texto y volver a leerlos da lo mismo (para editar la receta)');

  const { fila, error } = limpiarReceta({ nombre: '  Porridge ', tomas: ['cena', 'desayuno', 'otra'], raciones: '2', kcal: '505', proteina_g: '38,5', carbos_g: 72, grasa_g: '', ingredientes: '50 g avena\n1 plátano', preparacion: '  ', minutos: '8', etiquetas: ['Rápida', 'Rápida', ' '] });
  check(!error && fila.nombre === 'Porridge' && igual(fila.tomas, ['desayuno', 'cena']) && fila.raciones === 2 && fila.kcal === 505 && fila.proteina_g === 38.5 && fila.grasa_g === null
    && fila.ingredientes.length === 2 && fila.preparacion === null && fila.minutos === 8 && igual(fila.etiquetas, ['Rápida']), 'la receta del formulario, limpia: tomas en su orden y sin inventadas, coma decimal, sin vacíos ni repetidas');
  check(limpiarReceta({ nombre: ' ' }).error && limpiarReceta({ nombre: 'X', raciones: 30 }).error && limpiarReceta({ nombre: 'X', kcal: 'mucho' }).error && limpiarReceta({ nombre: 'X', kcal: 9000 }).error
    && limpiarReceta({ nombre: 'X', minutos: 900 }).error && limpiarReceta({ nombre: 'X'.repeat(81) }).error, 'sin nombre, con raciones, kcal o minutos imposibles: dice qué falta');
  check(avisoMacros({ kcal: 450, proteina_g: 30, carbos_g: 60, grasa_g: 10 }) === null && /450 kcal/.test(avisoMacros({ kcal: 600, proteina_g: 30, carbos_g: 60, grasa_g: 10 })) && avisoMacros({ kcal: 600 }) === null,
    'avisa si las kcal no cuadran con los macros (4/4/9, más de un 10 %); sin macros, nada');
  const rec = { id: 'r1', nombre: 'Avena', raciones: 2, kcal: 450, proteina_g: 30, carbos_g: 60, grasa_g: 10, ingredientes: [{ nombre: 'Avena', cantidad: 120, unidad: 'g' }, { nombre: 'Huevos', cantidad: 2, unidad: 'ud' }, { nombre: 'Sal' }] };
  check(igual(macrosDe(rec, 1.5, 2), { kcal: 1350, proteina_g: 90, carbos_g: 180, grasa_g: 30 }) && macrosDe({ kcal: null }, 2).kcal === null && textoMacros(macrosDe(rec), true) === '450 kcal · P 30 · H 60 · G 10',
    'los macros de una ración con el factor del atleta y las raciones');

  const asign = [{ id: 'a1', receta_id: 'r1', toma: 'desayuno', factor: 1, orden: 1, favorita: false }, { id: 'a2', receta_id: 'r2', toma: 'desayuno', factor: 1, orden: 2, favorita: true }, { id: 'a3', receta_id: 'x', toma: 'cena', factor: 1, orden: 0 }];
  const porToma = recetarioPorToma(asign, [rec, { ...rec, id: 'r2', nombre: 'Tostadas' }]);
  check(porToma.desayuno.map((a) => a.id).join() === 'a2,a1' && !porToma.cena && porToma.desayuno[0].receta.nombre === 'Tostadas', 'el recetario por toma: favoritas primero; una receta que ya no existe no sale');
  check(igual(tomasDe(null), TOMAS_DEFECTO) && igual(tomasDe({ tomas: ['cena', 'desayuno'] }), ['desayuno', 'cena']) && igual(ordenarTomas(['recena', 'comida', 'nada']), ['comida', 'recena']), 'sus comidas del día: las cuatro de siempre si no ha elegido; siempre en orden');

  const e1 = entradaMenu({ fecha: '2026-11-02', toma: 'desayuno', asignacion: { factor: 1.5, receta: rec }, raciones: 1 });
  check(e1.receta_id === 'r1' && e1.texto === 'Avena' && e1.kcal === 675 && e1.hecho === false, 'en el menú, una receta del recetario lleva sus macros ya con el factor');
  const e2 = entradaMenu({ fecha: '2026-11-02', toma: 'comida', texto: '  Comida fuera ', macros: { kcal: 800, proteina_g: '' } });
  check(e2.receta_id === null && e2.texto === 'Comida fuera' && e2.kcal === 800 && e2.proteina_g === null && entradaMenu({ fecha: 'x', toma: 'comida', texto: '  ' }) === null, 'o lo que escriba (con las kcal si las sabe); vacío, nada');
  check(igual(cambiarRaciones({ raciones: 1, kcal: 400, proteina_g: 30, carbos_g: null, grasa_g: 10 }, 1.5), { raciones: 1.5, kcal: 600, proteina_g: 45, carbos_g: null, grasa_g: 15 }) && cambiarRaciones({ raciones: 1, kcal: 1 }, 99).raciones === 10,
    'cambiar las raciones cambia sus macros en proporción (como mucho 10)');
  const menu = [{ ...e1, id: 'm1', hecho: true, orden: 0 }, { ...e2, id: 'm2', orden: 0 }, { ...e2, id: 'm3', fecha: '2026-11-08', kcal: null, orden: 0 }, { ...e2, id: 'm4', fecha: '2026-11-09', orden: 0 }];
  const t = totalesDia(menu.filter((e) => e.fecha === '2026-11-02'));
  check(t.kcal === 1475 && t.conDatos === 2 && t.total === 2 && totalesDia(menu.filter((e) => e.fecha === '2026-11-02'), true).kcal === 675, 'los totales del día (y solo lo comido)');
  const pd = menuPorDia(menu, '2026-11-02');
  check(Object.keys(pd).length === 7 && pd['2026-11-02'].desayuno.length === 1 && pd['2026-11-08'].comida.length === 1 && !pd['2026-11-09'], 'el menú de la semana por día y toma (lo de otra semana no entra)');
  const cop = copiarMenu(menu, '2026-11-02', '2026-11-09');
  check(cop.length === 3 && cop.every((x) => !x.hecho && !x.id) && cop[0].fecha === '2026-11-09' && cop[2].fecha === '2026-11-15', 'copiar una semana: las mismas comidas 7 días después, sin «hecho»');
  const lc = listaCompra([{ receta_id: 'r1', raciones: 1, texto: 'Avena' }, { receta_id: 'r1', raciones: 2, texto: 'Avena' }, { receta_id: null, texto: 'Comida fuera' }, { receta_id: null, texto: 'Comida fuera' }], [rec], [{ receta_id: 'r1', factor: 1.5 }]);
  const avena = lc.items.find((i) => i.nombre === 'Avena');
  check(avena.cantidad === 270 && lc.items.find((i) => i.nombre === 'Huevos').cantidad === 5 && lc.items.find((i) => i.nombre === 'Sal').cantidad === null && igual(lc.libres, ['Comida fuera']),
    'la lista de la compra suma los ingredientes (× factor × raciones ÷ raciones de la receta; lo que va por piezas, hacia arriba); lo escrito a mano va aparte, una vez');
  check(listaCompra([{ receta_id: 'r2', raciones: 1 }], [{ id: 'r2', nombre: 'X', raciones: 4, ingredientes: [{ nombre: 'Cebolla', cantidad: 1 }, { nombre: 'Ajo', cantidad: 2, unidad: 'diente' }, { nombre: 'Aceite', cantidad: 2, unidad: 'cda' }] }], []).items.map((i) => i.cantidad).join() === '0.5,1,1', 'media cebolla y medio diente se compran enteros; las cucharadas no');
  check(/☐ 270 g de avena/.test(textoListaCompra(lc)) && /Sin receta:\n☐ Comida fuera/.test(textoListaCompra(lc)), 'y en texto, para copiarla');

  check(valeParaDia({ variante: null }, true) && valeParaDia({ variante: 'sin' }, true) && !valeParaDia({ variante: 'con' }, true) && valeParaDia({ variante: 'con' }, false) && !valeParaDia({ variante: 'sin' }, false)
    && textoVariante('sin', 'merienda') === 'Días sin merienda' && textoVariante('con', null) === null
    && tomasDelDia(['desayuno', 'comida', 'merienda', 'cena'], 'merienda', true).join() === 'desayuno,comida,cena'
    && tomasDelDia(['desayuno', 'merienda'], 'merienda', true, ['merienda']).length === 2 && tomasDelDia(['desayuno', 'merienda'], 'merienda', false).length === 2
    && paraElDia([{ receta_id: 'c', toma: 'comida', variante: null }, { receta_id: 'c', toma: 'comida', variante: 'sin' }, { receta_id: 'l', toma: 'comida', variante: null }], true).map((a) => a.receta_id + (a.variante || '')).join() === 'csin,l'
    && paraElDia([{ receta_id: 'c', toma: 'comida', variante: null }, { receta_id: 'c', toma: 'comida', variante: 'sin' }], false).length === 1,
    'días sin merienda: qué recetas valen ese día (la versión del día, no las dos) y qué comidas se ven (la merienda, solo si ya tenía algo apuntado)');
  check(conEntrenamiento({}) && !conEntrenamiento({ entrenamiento: false }) && servicioDe({ entrenamiento: false }) === 'nutricion' && servicioDe({ nutricion: false }) === 'entrenamiento' && servicioDe({}) === 'completo'
    && igual(CAMPOS_SERVICIO.nutricion, { entrenamiento: false, nutricion: true }) && textoServicio({ entrenamiento: false }) === 'Solo nutrición', 'servicio: entrenamiento, completo o solo nutrición');
  const solo = resumenAtleta({ atleta: { id: 'l', nombre: 'Lucía', estado: 'activo', entrenamiento: false }, bloque: null, cambiosReceta: 2, diasNutricion: 5 }, '2026-11-04');
  check(!solo.alertas.some((a) => ['sin_bloque', 'sin_entrenar', 'publicar', 'programar'].includes(a.tipo)) && solo.alertas.some((a) => a.tipo === 'receta' && /2 recetas/.test(a.texto)) && solo.servicio === 'nutricion' && solo.diasNutricion === 5,
    'a quien solo le llevas la nutrición, ningún aviso de entrenamiento (sí el de las recetas que pide cambiar)');
  check(resumenAtleta({ atleta: { id: 'x', nombre: 'X', estado: 'activo' }, bloque: null }, '2026-11-04').alertas.some((a) => a.tipo === 'sin_bloque'), 'a los demás, como siempre');
  const dia = tuDia({ menu: { total: 4, hechas: 1 } });
  check(dia.some((x) => x.id === 'menu' && x.estado === 'luego' && /1 de 4/.test(x.detalle)) && tuDia({ menu: { total: 2, hechas: 2 } }).find((x) => x.id === 'menu').estado === 'hecho' && !tuDia({}).some((x) => x.id === 'menu'), '«Tu día» con su menú de hoy');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
