import { readFileSync } from 'node:fs';
// Lógica pura: fechas, 1RM estimado, propuestas de series, avisos del coach y la cola sin conexión.
import { lunesDe, sumarDias, diasEntre, hace, rangoSemana } from '../web/src/logica/fechas.js';
import { nombreEquipo, nombreValido, limpiarNombre, estadoReto, textoReto, ordenarRanking, quienes, recordsDeEquipo, REACCIONES,
  posicionesRanking, textoRacha, mencionEnCurso, sugerenciasMencion, insertarMencion, mencionesDeTexto, trozosConMenciones, encuestaCerrada, resultadosEncuesta, limpiarEncuesta, retoConseguido,
  FILTROS_MURO } from '../web/src/logica/comunidad.js';
import { conDefecto, preferenciasValidas, claveServidor, normalizarB64url, describirDispositivo, soportePush, esIos, momentoNotificacion, PREFERENCIAS_DEFECTO, TIPOS_ATLETA, TIPOS_COACH } from '../web/src/logica/notificaciones.js';
import { resultadoCribado, avisoCuestionario, resumenCuestionario, limpiarCuestionario, pasosHechos, MENSAJE_ATLETA, RESULTADO_COACH, SINTOMAS, OTRAS, objetivosDe, textoObjetivos } from '../web/src/logica/cuestionario.js';
import { pregunta, preguntasDe, respuestaValida, limpiarRespuestas, respuestasNoValidas, textoRespuesta, serieRespuestas } from '../web/src/logica/preguntas.js';
import { grados, dibujoValido, limpiarDibujo, rectImagen, describirDibujo } from '../web/src/logica/dibujo.js';
import { tuDia, resumenDia } from '../web/src/logica/dia.js';
import { progresarPauta, opcionesDe } from '../web/src/logica/progresion.js';
import { sumarMeses, finPeriodo, importePeriodo, siguientePeriodo, resumenCobros, cobradoEnMes, fmtEuros, leerEuros } from '../web/src/logica/cobros.js';
import { modoCarga, columnasEditor, pesoAnterior, conNutricion, textoServicio, NIVELES } from '../web/src/logica/nivel.js';
import { cardioValido, cardioHechoValido, limpiarCardio, limpiarCardioHecho, textoCardio, textoCardioHecho, ritmo, palabrasEsfuerzo, cardioPorSemana, cardioHechoDe } from '../web/src/logica/cardio.js';
import { valeParaDia, textoVariante, tomasDelDia, paraElDia, leerIngrediente, leerIngredientes, escalarCantidad, textoIngrediente, ingredientesATexto, limpiarReceta, avisoMacros, macrosDe, textoMacros, recetarioPorToma, entradaMenu, cambiarRaciones, totalesDia, menuPorDia, copiarMenu, listaCompra, textoListaCompra, paraComprar, claveCompra, nombreCompra, seccionCompra, porSecciones, lineaCompra, tomasDe, ordenarTomas, TOMAS_DEFECTO } from '../web/src/logica/comidas.js';
import { conEntrenamiento, servicioDe, CAMPOS_SERVICIO, fichaCambiada } from '../web/src/logica/nivel.js';
import { materialesDe, revisarVariante, varianteSinMaterial, equivalentes } from '../web/src/logica/variantes.js';
import { destinoEnRejilla } from '../web/src/ui/rejilla.js';
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
{
  const ejs = { p: { id: 'p', nombre: 'Press inclinado', grupos_musculares: ['pectoral', 'deltoides', 'triceps'] }, m: { id: 'm', nombre: 'Press militar', grupos_musculares: ['deltoides', 'triceps'] } };
  const d = C.desglosePautadoPorGrupo([{ ejercicio_id: 'p', series: 3 }, { ejercicio_id: 'm', series: 4 }, { ejercicio_id: 'p', series: 2 }], ejs);
  check(igual(d.pectoral, [{ id: 'p', nombre: 'Press inclinado', series: 5, principal: true }]) && igual(d.deltoides.map((x) => [x.nombre, x.series, x.principal]), [['Press militar', 4, true], ['Press inclinado', 5, false]]),
    'desglose (v0.35): de dónde sale cada número; un ejercicio en dos sesiones se suma; primero lo que cuenta entero');
  check(igual(C.conPrincipal(['deltoides', 'triceps', 'pectoral'], 'pectoral'), ['pectoral', 'deltoides', 'triceps']) && igual(C.conPrincipal(['pectoral'], 'espalda'), ['pectoral']),
    'elegir el principal lo pone el primero sin cambiar el orden del resto');
}

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
  const { consejoPreparacion, completa, textoPreparacion, subeCarga } = await import('../web/src/logica/preparacion.js');
  const flojo = consejoPreparacion({ sueno: 1, energia: 2, molestias: 3 });
  check(!subeCarga(flojo, null) && !subeCarga(flojo, 'igual') && subeCarga(flojo, 'subir') && subeCarga(consejoPreparacion({ sueno: 3, energia: 3, molestias: 3 }), null) && subeCarga(null, null),
    'día flojo: sube la carga solo si el atleta lo elige (sin elegir, los pesos de la última vez); un buen día, como siempre');
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
  check(TIPOS_ATLETA.length === 11 && TIPOS_COACH.length === 7 && TIPOS_COACH.every(([t]) => t === 'comunidad' || !TIPOS_ATLETA.some(([a]) => a === t)),
    'tipos del atleta (con el fin del descanso, v0.39, y las tareas, v0.48) y del coach (con las tareas hechas), sin repetir (salvo «Equipo», v0.43, que tienen los dos)');
  check(preferenciasValidas({ ...d, desactivados: ['tarea', 'tarea_hecha'] }), 'quitar las de las tareas (v0.48) es una preferencia válida');
  check(preferenciasValidas({ ...d, desactivados: ['comunidad'] }), 'quitar las del equipo es una preferencia válida');
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
  // v0.46: la ficha que se vuelve a leer al volver a la app cambia con cualquier campo, también el peso semanal
  const ficha = { id: 'a', nombre: 'Atleta', nutricion: true, peso_frecuencia: 'diario', checkin_apartados: null };
  check(fichaCambiada(ficha, { ...ficha, peso_frecuencia: 'semanal' }) && fichaCambiada(ficha, { ...ficha, entrenamiento: false })
    && !fichaCambiada(ficha, { ...ficha }) && !fichaCambiada(ficha, { ...ficha, objetivo: null }) && !fichaCambiada(ficha, null)
    && fichaCambiada(ficha, { ...ficha, checkin_apartados: ['peso'] }), 'fichaCambiada: cualquier campo de la ficha (peso semanal incluido)');
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

console.log('\nPauta serie a serie (v0.28)');
{
  const D = [{ reps: 8, kg: 25, rpe: 7 }, { reps: 10, kg: 22.5, rpe: 8 }, { reps: 12, kg: 22.5, rpe: 9 }];
  check(JSON.stringify(C.limpiarDetalle([{ reps: '8', kg: '22,5', rpe: '' }, {}])) === '[{"reps":8,"kg":22.5},{}]' && C.limpiarDetalle([{ reps: 8.5 }]) === null
    && C.limpiarDetalle([{ rpe: 11 }]) === null && C.limpiarDetalle([]) === null && C.limpiarDetalle(Array(21).fill({})) === null, 'el detalle se limpia (comas, vacíos) y lo que no vale no pasa');
  const ag = C.agregadosDetalle(D);
  check(ag.series === 3 && ag.reps_min === 8 && ag.reps_max === 12 && ag.carga_sugerida_kg === 22.5 && ag.rpe_objetivo === 9, 'el resumen: series, reps mín–máx, los kilos de la mayoría y el RPE de la última');
  check(C.agregadosDetalle([{ kg: 30 }, { kg: 27.5 }]).carga_sugerida_kg === 30, 'si todas cambian de kilos, los de la primera');
  check(JSON.stringify(C.detalleDesdePauta({ series: 2, reps_min: 8, reps_max: 10, carga_sugerida_kg: 30, rpe_objetivo: 8 })) === '[{"reps":10,"kg":30,"rpe":8},{"reps":10,"kg":30,"rpe":8}]', 'pasar a serie a serie parte de lo pautado');
  const se = { series: 3, ...ag, series_detalle: D, rir_objetivo: null, backoff_pct: null };
  check(pauta(se).series === '3 series: 8 · 10 · 12' && pauta(se).detalle && C.textoObjetivo(D[1]) === '10 × 22,5 kg @8' && C.textoObjetivo({ reps: 12 }) === '12 reps'
    && JSON.stringify(C.objetivoSerie(se, 2)) === JSON.stringify(D[1]) && C.objetivoSerie({ series: 3 }, 1) === null, 'en texto, y lo de cada serie para el atleta');
  const sube = progresarPauta(se, { kg: 'salto', rpe: 0, rir: 0, reps: 0 }, { nombre: 'Sentadilla barra alta' });
  check(JSON.stringify(sube.series_detalle.map((x) => x.kg)) === '[27.5,25,25]' && sube.carga_sugerida_kg === 25 && sube.series_detalle[0].rpe === 7, 'preparar la siguiente: cada serie sube su salto (y su RPE se queda)');
  const des = progresarPauta(se, {}, { nombre: 'Sentadilla barra alta', descarga: true });
  check(des.series === 2 && des.series_detalle.length === 2 && des.series_detalle[0].kg === 22.5 && des.series_detalle[0].rpe === 6, 'en descarga, una serie menos y cada una más ligera');
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
  { const l2 = listaCompra([{ receta_id: 'r2', raciones: 1 }], [{ id: 'r2', nombre: 'X', raciones: 4, ingredientes: [{ nombre: 'Cebolla', cantidad: 1 }, { nombre: 'Ajo', cantidad: 2, unidad: 'diente' }, { nombre: 'Aceite', cantidad: 2, unidad: 'cda' }] }], []).items;
    const de = (n) => l2.find((i) => i.nombre === n);
    check(de('Cebolla').cantidad === 1 && de('Ajo').cantidad === 1 && de('Ajo').unidad === 'diente' && de('Ajo').texto === '1 diente' && de('Aceite').cantidad === 8 && de('Aceite').unidad === 'ml',
      'media cebolla y medio diente se compran enteros; las cucharadas, en ml (media cucharada, 7,5 ml: 8 ml)'); }
  check(/☐ Avena: 270 g/.test(textoListaCompra(lc)) && /Sin receta:\n☐ Comida fuera/.test(textoListaCompra(lc)), 'y en texto, para copiarla');
  // v0.53.1: totales de lo que se compra, aunque cada receta lo escriba a su manera (recetas inventadas, al estilo de Notion)
  {
    const R = (id, nombre, lineas, raciones = 1) => ({ id, nombre, raciones, ingredientes: leerIngredientes(lineas.join('\n')) });
    const recs = [
      R('a', 'Tortilla francesa', ['1 cda (10 ml) de AOVE', '2 huevos M (100 g)', '5 claras de huevo (165 g)', 'Sal y pimienta al gusto']),
      R('b', 'Pollo con verduras', ['1,5 cdas (15 ml) de AOVE', '180 g de pechuga de pollo', '2 huevos M cocidos (100 g)', 'Sal, pimienta y pimentón al gusto', 'Guarnición:', '100 g de arroz basmati (peso en crudo)']),
      R('c', 'Ensalada templada', ['¾ cda (7 ml) de AOVE', '1 cdta (5 ml) de AOVE', '3 huevos M (150 g)', '6 claras de huevo (200 g)', '0,12 kg de pechugas de pollo (peso en crudo)', 'Sal y pimienta al gusto', '60 g de arroz integral (peso en crudo)']),
      R('d', 'Albóndigas', ['245 g de pollo picado (peso en crudo)', '1 cda de aceite de oliva', '1 cdta de pimentón', '1 kg de tomate triturado', '250 g de tomate triturado', '2 filetes de pechuga de pollo', 'Un chorrito de vino blanco']),
    ];
    const lc = listaCompra(recs.map((r) => ({ receta_id: r.id, raciones: 1 })), recs, []);
    const de = (n) => lc.items.filter((i) => i.nombre === n);
    const una = (n) => (de(n).length === 1 ? de(n)[0] : null);
    check(igual(leerIngrediente('1,5 cdas (15 ml) de AOVE'), { nombre: 'AOVE (15 ml)', cantidad: 1.5, unidad: 'cda' }) && igual(leerIngrediente('2 huevos M (100 g)'), { nombre: 'Huevos M (100 g)', cantidad: 2 }),
      'las recetas se siguen leyendo y guardando como siempre (la equivalencia, en el nombre): esto es solo para la lista');
    const aove = una('AOVE');
    check(aove && aove.texto === '37 ml' && aove.cantidad === 37 && aove.unidad === 'ml' && lc.items.filter((i) => /aove/i.test(i.nombre)).length === 1 && aove.recetas.length === 3,
      `el AOVE en cda, cdas, cdta y ¾ cda, con sus ml escritos (10 + 15 + 7 + 5), en una línea: «AOVE: 37 ml» (${aove?.texto})`);
    check(una('Aceite de oliva')?.texto === '15 ml' && una('Pimentón')?.texto === '5 ml', 'sin ml escritos, la cucharada son 15 ml y la cucharadita 5 ml');
    { const r = R('x', 'Para dos', ['1 cda (10 ml) de AOVE', '2 huevos M (100 g)'], 2);
      const l = listaCompra([{ receta_id: 'x', raciones: 3 }], [r], [{ receta_id: 'x', factor: 1.5 }]).items;
      check(l.find((i) => i.nombre === 'AOVE').texto === '23 ml' && l.find((i) => i.nombre === 'Huevos M').texto === '5 (≈ 225 g)',
        'lo escrito entre paréntesis se multiplica como lo demás (× 1,5 de factor × 3 raciones ÷ 2 de la receta: 22,5 ml; 4,5 huevos, que son 5, unos 225 g)'); }
    const huevos = una('Huevos M');
    check(huevos && huevos.texto === '7 (≈ 350 g)' && huevos.cantidad === 7 && huevos.unidad === 'ud' && !de('Huevos M cocidos').length && lineaCompra(huevos) === 'Huevos M: 7 (≈ 350 g)',
      `los huevos con y sin «cocidos» van juntos, en piezas y con su peso como pista: «Huevos M: 7 (≈ 350 g)» (${huevos && lineaCompra(huevos)})`);
    check(igual(huevos.detalle, [{ receta: 'Tortilla francesa', texto: '2 (≈ 100 g)' }, { receta: 'Pollo con verduras', texto: '2 (≈ 100 g)' }, { receta: 'Ensalada templada', texto: '3 (≈ 150 g)' }]),
      'y lo de cada receta, para desplegarlo («en 3 recetas»)');
    check(una('Claras de huevo')?.texto === '11 (≈ 365 g)', 'las claras, aparte de los huevos enteros: 11 (≈ 365 g)');
    const pechuga = una('Pechuga de pollo');
    check(pechuga && lineaCompra(pechuga) === 'Pechuga de pollo: 300 g + 2 filetes' && pechuga.cantidad === null && pechuga.unidad === null && pechuga.recetas.length === 3,
      `con unidades que no se suman (gramos y filetes), una sola línea con las dos: «Pechuga de pollo: 300 g + 2 filetes» (${pechuga && lineaCompra(pechuga)}); 0,12 kg de «pechugas» cuentan`);
    check(una('Pollo picado (peso en crudo)')?.texto === '245 g' && lc.items.filter((i) => /pollo/i.test(i.nombre)).length === 2, 'el pollo picado no se junta con la pechuga (es otra compra)');
    check(una('Arroz basmati (peso en crudo)')?.texto === '100 g' && una('Arroz integral (peso en crudo)')?.texto === '60 g', 'el arroz basmati y el integral, cada uno en su línea');
    const tomate = una('Tomate triturado');
    check(tomate && tomate.texto === '1,25 kg' && tomate.cantidad === 1250 && tomate.unidad === 'g', 'kg y g se suman (1 kg + 250 g: 1,25 kg)');
    check(una('Sal y pimienta al gusto')?.texto === '' && igual(una('Sal y pimienta al gusto').recetas, ['Tortilla francesa', 'Ensalada templada']) && una('Sal, pimienta y pimentón al gusto')
      && una('Un chorrito de vino blanco')?.cantidad === null && !lc.items.some((i) => /Guarnici/.test(i.nombre)),
      'lo que no lleva cantidad sale una vez, tal cual («Sal y pimienta al gusto», en 2 recetas); lo que no se entiende, también; «Guarnición:» es un título, no se compra');
    // Nada se pierde: lo que entra (contado aparte, de lo que se escribió) es lo que sale, grupo a grupo y en total
    const entra = { g: 180 + 100 + 120 + 60 + 245 + 1000 + 250, ml: 10 + 15 + 7 + 5 + 15 + 5, piezas: 2 + 5 + 2 + 3 + 6 + 2 };
    const sale = lc.items.reduce((t, i) => ({ g: t.g + i.suma.g, ml: t.ml + i.suma.ml, piezas: t.piezas + Object.values(i.suma.piezas).reduce((a, p) => a + p.n, 0) }), { g: 0, ml: 0, piezas: 0 });
    const porGrupo = {};
    for (const r of recs) for (const i of r.ingredientes) for (const x of paraComprar(i)) { const e = (porGrupo[x.clave] ||= { g: 0, ml: 0, n: 0 }); e.g += x.g || 0; e.ml += x.ml || 0; e.n += x.piezas?.n || 0; }
    const cerca = (a, b) => Math.abs(a - b) < 1e-9;
    const lineas = recs.reduce((t, r) => t + r.ingredientes.length, 0);
    check(cerca(entra.g, sale.g) && cerca(entra.ml, sale.ml) && cerca(entra.piezas, sale.piezas) && Object.keys(porGrupo).length === lc.items.length
      && lc.items.every((i) => porGrupo[i.clave] && cerca(porGrupo[i.clave].g, i.suma.g) && cerca(porGrupo[i.clave].ml, i.suma.ml) && cerca(porGrupo[i.clave].n, Object.values(i.suma.piezas).reduce((a, p) => a + p.n, 0)))
      && lc.items.length < lineas, `nada se pierde: ${entra.g} g, ${entra.ml} ml y ${entra.piezas} piezas entran y salen, grupo a grupo (${lineas} líneas en ${lc.items.length})`);
    // «4 claras (132 g) + 1 huevo entero (50 g)»: dos cosas, si las dos se entienden; si no, como está
    const mas = R('m', 'Revuelto', ['2 huevos M (100 g)', '4 claras de huevo (132 g) + 1 huevo entero (50 g)', '1 bote + medio de tomate']);
    const lm = listaCompra([{ receta_id: 'm', raciones: 1 }], [mas], []).items;
    check(lm.find((i) => i.nombre === 'Claras de huevo')?.texto === '4 (≈ 130 g)' && lm.find((i) => i.nombre === 'Huevos M')?.texto === '3 (≈ 150 g)' && lm.some((i) => i.nombre === 'Bote + medio de tomate') && lm.length === 3,
      '«4 claras de huevo (132 g) + 1 huevo entero (50 g)» se parte en claras (4, unos 130 g: el peso, de 5 en 5) y huevo; «1 bote + medio de tomate» (la otra parte no se entiende) se queda como está');
    check(una('Huevos M') && (() => { const p = listaCompra([{ receta_id: 'p', raciones: 1 }], [R('p', 'P', ['2 huevos M (100 g)', '1 huevo'])], []).items[0]; return p.texto === '3' && p.suma.piezas.ud.n === 3; })(),
      'si alguna pieza no trae su peso, el peso no se adivina: «3», sin pista');
  }
  {
    const k = claveCompra;
    check(k('Huevos M cocidos (100 g)') === k('huevo') && k('Dientes de ajo') === k('diente de ajo') && k('Tomate en dados') === k('Tomates') && k('Espinacas frescas') === k('Espinacas')
      && k('Nueces') === k('Nuez') && k('Pechuga de pollo a la plancha') === k('Pechugas de pollo (peso en crudo)') && k('Sal y pimienta al gusto') === k('Sal y pimienta') && k('Ternera magra (5% grasa, en crudo)') === k('Ternera magra')
      && k('Calabacín troceado') === k('calabacines') && k('Huevo entero') === k('Huevos L') && k('Garbanzos cocidos') === k('Garbanzos'),
      'la clave: sin acentos ni paréntesis, en singular, sin «al gusto» ni lo que no cambia la compra (cocido, fresco, troceado, en dados, a la plancha, la talla del huevo)');
    check(k('Pollo picado') !== k('Pechuga de pollo') && k('Arroz basmati') !== k('Arroz integral') && k('Arroz redondo') !== k('Arroz') && k('Leche desnatada') !== k('Leche') && k('Queso rallado light') !== k('Queso rallado')
      && k('Pechuga de pavo en lonchas') !== k('Pechuga de pavo') && k('Claras de huevo') !== k('Huevos') && k('Pan integral') !== k('Pan'),
      'lo que sí cambia la compra se queda: picado, basmati, integral, redondo, desnatado, light, en lonchas, claras');
    check(nombreCompra('Huevos M (100 g)') === 'Huevos M' && nombreCompra('Patata (peso en crudo, 1 patata pequeña)') === 'Patata (peso en crudo)' && nombreCompra('Ternera magra (5% grasa, en crudo)') === 'Ternera magra (5% grasa, en crudo)'
      && nombreCompra('Proteína en polvo (½ scoop)') === 'Proteína en polvo' && nombreCompra('Crackers integrales (4-5 unidades)') === 'Crackers integrales',
      'el nombre en la lista, sin la equivalencia ni la cantidad de una receta («(1 patata pequeña)»), con sus notas («peso en crudo», «5% grasa»)');
    const s = (n) => seccionCompra(k(n));
    check(s('Pechuga de pollo') === 'Proteínas' && s('Claras de huevo') === 'Proteínas' && s('Caldo de pollo desgrasado') === 'Despensa' && s('Zumo de ½ limón') === 'Verduras y fruta' && s('Tomates cherry') === 'Verduras y fruta'
      && s('Arroz basmati') === 'Hidratos' && s('Queso cottage') === 'Lácteos' && s('Mantequilla de cacahuete') === 'Despensa' && s('Mantequilla') === 'Lácteos' && s('Leche de coco light') === 'Despensa' && s('Leche desnatada') === 'Lácteos' && s('AOVE') === 'Despensa' && s('Hielo') === 'Otros',
      'las secciones del súper por palabras: manda la que sale antes («caldo de pollo», despensa) y la más larga («mantequilla de cacahuete», «leche de coco»); si no, «Otros»');
    const items = [{ nombre: 'Hielo', seccion: 'Otros' }, { nombre: 'AOVE', seccion: 'Despensa' }, { nombre: 'Huevos', seccion: 'Proteínas' }];
    check(porSecciones(items).map((x) => x.seccion).join() === 'Proteínas,Despensa,Otros', 'por secciones, en el orden del súper y sin las vacías');
    const recs = [{ id: 'a', nombre: 'A', raciones: 1, ingredientes: leerIngredientes('1 cda (10 ml) de AOVE\n2 huevos M (100 g)\nHielo') }, { id: 'b', nombre: 'B', raciones: 1, ingredientes: leerIngredientes('1 cdta (5 ml) de AOVE\n1 huevo M (50 g)') }];
    const t = textoListaCompra(listaCompra([{ receta_id: 'a', raciones: 1 }, { receta_id: 'b', raciones: 1 }], recs, []), 'Compra');
    check(t === 'Compra\n\nProteínas:\n☐ Huevos M: 3 (≈ 150 g)\n\nDespensa:\n☐ AOVE: 15 ml\n\nOtros:\n☐ Hielo', `el texto para copiar, con los totales y por secciones:\n${t}`);
    check(listaCompra([], [], []).items.length === 0 && paraComprar(null).length === 0 && paraComprar({ nombre: 'Para la salsa:' }).length === 0, 'sin nada, nada');
  }

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

{
  console.log('Variantes de material (v0.30)');
  const bib = [
    { id: 'm1', nombre: 'Press militar sentado con mancuernas', alternativas: ['m2', 'm3'] },
    { id: 'm2', nombre: 'Press militar en máquina/inverso', alternativas: [] },
    { id: 'm3', nombre: 'Press militar con barra', alternativas: [] },
    { id: 'p1', nombre: 'Press plano en máquina', alternativas: [] },
    { id: 'r1', nombre: 'Remo con mancuerna a una mano', alternativas: [] },
    { id: 'r2', nombre: 'Remo en máquina (miscelánea)', alternativas: [] },
    { id: 'b1', nombre: 'Press banca', alternativas: [] },
    { id: 'i1', nombre: 'Press inclinado con mancuernas', alternativas: [] },
    { id: 'i2', nombre: 'Press inclinado en máquina', alternativas: [] },
    { id: 'h1', nombre: 'Hip thrust', alternativas: [] },
    { id: 'e1', nombre: 'Extensiones desde polea alta con barra V1/2/3', alternativas: [] },
  ];
  const E = Object.fromEntries(bib.map((e) => [e.id, e]));
  check([...materialesDe('En máquina Technogym')].join() === 'maquina' && [...materialesDe('Mancuernas/Máquina')].sort().join() === 'mancuernas,maquina' && materialesDe('Pausa de 1 s').size === 0, 'reconoce el material que nombra un texto (sin tildes ni mayúsculas)');
  const r = revisarVariante(E.m1, 'En máquina', bib);
  check(r && r.propuestas.map((x) => x.id).join() === 'm2' && /dice m\u00e1quina, pero el ejercicio es con mancuernas/.test(r.texto), 'con mancuernas y variante «En máquina»: lo avisa y propone la alternativa en máquina');
  check(revisarVariante(E.i1, 'En máquina', bib)?.propuestas.map((x) => x.id).join() === 'i2' && revisarVariante(E.r1, 'En máquina Technogym de discos', bib)?.propuestas.length === 0,
    'sin alternativas apuntadas, propone el del mismo movimiento (press inclinado), no uno que solo comparte «remo»');
  check(revisarVariante(E.m1, 'Mancuernas/Máquina', bib) === null && revisarVariante(E.m1, 'O en máquina', bib) === null, 'si la variante deja elegir, no avisa');
  check(revisarVariante(E.h1, 'Con barra', bib) === null && revisarVariante(E.e1, 'Barra recta o cuerda', bib) === null && revisarVariante(E.m1, 'Sentado, con pausa', bib) === null, 'si el ejercicio no dice material, o la variante es del mismo, no avisa');
  check(revisarVariante(E.b1, 'Con mancuernas', bib) !== null, 'el press banca es con barra aunque no lo diga');
  const ej = (nombre) => ({ id: 'x', nombre, alternativas: [] });
  check(revisarVariante(ej('Remo sentado en polea baja'), 'Con barra ancha', bib) === null && revisarVariante(ej('Sentadilla en multipower'), 'Barra alta', bib) === null,
    'la barra de una polea (barra en V, recta) o de un multipower no es la barra libre');
  check(revisarVariante(E.b1, 'Con gomas', bib) === null && revisarVariante(ej('Pájaros desde polea baja'), 'Band pull apart con goma elástica', bib) !== null,
    'una goma con barra es resistencia añadida; en lugar de una polea, sí cambia el ejercicio');
  check(revisarVariante(E.r1, 'Apoyado en banco, o en máquina', bib) === null && revisarVariante(E.b1, 'Con mancuernas o en máquina', bib) !== null && revisarVariante(E.m1, 'Sin máquina', bib) === null,
    '«…, o en máquina» es una opción; «con mancuernas o en máquina» en un press banca no; «sin máquina» no nombra la máquina');
  check(revisarVariante(ej('Remo con barra'), 'En máquina', [...bib, { id: 'r9', nombre: 'Remo en T en máquina', alternativas: [] }]).propuestas.length === 0,
    'sin alternativas, no propone otro movimiento solo por compartir la primera palabra');
  check(varianteSinMaterial('En máquina') === null && varianteSinMaterial('Con mancuernas o en máquina') === null && varianteSinMaterial('Máquina Technogym de discos') === 'Máquina Technogym de discos', 'al cambiar de ejercicio, la variante que solo decía el material se quita');
  check(equivalentes(E.m2, bib).map((x) => x.id).join() === 'm1' && equivalentes(E.m1, bib).map((x) => x.nombre).join() === 'Press militar con barra,Press militar en máquina/inverso', 'equivalentes para el desplegable: sus alternativas y quien lo tiene como alternativa');
}

console.log('\nMoverse por la programación con el teclado (v0.34)');
{
  // Una pauta de series iguales, una serie a serie de 3 series (con su fila de RIR) y otra de series iguales
  const F = [['series', 'reps_min', 'reps_max', 'rpe', 'kg'], ['reps', 'kg', 'rpe'], ['reps', 'kg', 'rpe'], ['reps', 'kg', 'rpe'], ['rir'], ['series', 'reps_min', 'reps_max', 'kg']];
  check(igual(destinoEnRejilla(F, { fila: 1, col: 1 }, 'abajo'), { fila: 2, col: 1 }), 'Intro o ↓ en los kilos de una serie: los kilos de la serie de debajo');
  check(igual(destinoEnRejilla(F, { fila: 3, col: 1 }, 'abajo'), { fila: 5, col: 3 }), 'de la última serie, a los kilos del ejercicio siguiente (saltando la fila que no tiene kilos)');
  check(igual(destinoEnRejilla(F, { fila: 1, col: 0 }, 'arriba'), { fila: 0, col: 1 }) && igual(destinoEnRejilla(F, { fila: 0, col: 2 }, 'abajo'), { fila: 1, col: 0 }),
    'las reps de una serie se corresponden con las reps mín./máx. de una pauta de series iguales');
  check(igual(destinoEnRejilla(F, { fila: 3, col: 2 }, 'abajo'), null) && igual(destinoEnRejilla(F, { fila: 0, col: 0 }, 'arriba'), null), 'si no hay casilla de esa columna más allá, no se mueve');
  check(igual(destinoEnRejilla(F, { fila: 1, col: 1 }, 'derecha'), { fila: 1, col: 2 }) && igual(destinoEnRejilla(F, { fila: 1, col: 2 }, 'derecha'), null) && igual(destinoEnRejilla(F, { fila: 1, col: 0 }, 'izquierda'), null),
    '← → van a la casilla de al lado dentro de la fila');
}

console.log('\nLa comunidad del equipo (v0.43)');
{
  check(nombreEquipo('Ana López García') === 'Ana L.' && nombreEquipo('rubén martín') === 'rubén M.' && nombreEquipo('Lucía') === 'Lucía' && nombreEquipo('') === '',
    'el nombre de entrada en el equipo: nombre e inicial del apellido');
  check(limpiarNombre('  Ana \n  L. ') === 'Ana L.' && nombreValido('Al') && !nombreValido('A') && !nombreValido('x'.repeat(41)) && !nombreValido('\u200b\u200b'), 'el nombre, de 2 a 40 letras y con algo visible (como la base)');
  const r = { desde: '2026-11-02', hasta: '2026-11-29' };
  check(estadoReto(r, '2026-11-01') === 'proximo' && estadoReto(r, '2026-11-02') === 'en_marcha' && estadoReto(r, '2026-11-29') === 'en_marcha' && estadoReto(r, '2026-11-30') === 'terminado',
    'un reto está en marcha de su primer a su último día (los dos incluidos)');
  check(textoReto(r, '2026-11-01') === 'Empieza mañana' && textoReto(r, '2026-11-28') === 'Queda 1 día' && textoReto(r, '2026-11-29') === 'Último día' && textoReto(r, '2026-11-10') === 'Quedan 19 días', 'y dice cuánto le queda');
  const rk = ordenarRanking([{ nombre: 'B', hechas: 1, previstas: 3 }, { nombre: 'A', hechas: 2, previstas: 2 }, { nombre: 'C', hechas: 2, previstas: 3 }, { nombre: 'D', hechas: 0, previstas: 2 }]);
  check(rk.map((x) => x.nombre).join('') === 'ACBD', 'el ranking, por la proporción de lo previsto que lleva hecho (y luego por sesiones)');
  check(quienes(['Ana']) === 'Ana' && quienes(['Ana', 'Rubén']) === 'Ana y Rubén' && quienes(['Ana', 'Rubén', 'Carlos', 'Lucía']) === 'Ana, Rubén y 2 más', 'quién ha reaccionado, en corto');
  check(REACCIONES.map(([k]) => k).join() === 'fuerza,fuego,aplauso', 'las tres reacciones, con las claves de la base');
  const hist = [
    { sesion_id: 'vieja', ejercicio_id: 'press', kg: 100, reps: 5, rpe: 8, registrada_en: '2026-10-01T10:00:00Z' },
    { sesion_id: 'vieja', ejercicio_id: 'dominadas', kg: 0, reps: 8, registrada_en: '2026-10-01T10:10:00Z' },
    { sesion_id: 'hoy', ejercicio_id: 'press', kg: 40, reps: 5, rpe: 8, registrada_en: '2026-11-01T10:00:00Z' },
    { sesion_id: 'hoy', ejercicio_id: 'dominadas', kg: 0, reps: 10, registrada_en: '2026-11-01T10:10:00Z' },
    { sesion_id: 'hoy', ejercicio_id: 'remo', kg: 60, reps: 8, registrada_en: '2026-11-01T10:20:00Z' },
    { sesion_id: 'despues', ejercicio_id: 'dominadas', kg: 0, reps: 20, registrada_en: '2026-11-05T10:00:00Z' },
  ];
  check([...recordsDeEquipo(hist, 'hoy')].join() === 'dominadas', 'los récords de la tarjeta, como la base: 40 kg tras 100 no; más repeticiones sin carga sí; la primera vez no; lo de después no cuenta');
}


console.log('\nLas mejoras de la comunidad (v0.47)');
{
  const filas = ordenarRanking([{ nombre: 'C', hechas: 2, previstas: 3 }, { nombre: 'A', hechas: 3, previstas: 3 }, { nombre: 'B', hechas: 3, previstas: 3 }, { nombre: 'D', hechas: 1, previstas: 3 }]);
  check(posicionesRanking(filas).join() === '1,1,3,4' && filas.map((x) => x.nombre).join() === 'A,B,C,D', 'el podio respeta los empates del ranking (1, 1, 3)');
  check(textoRacha(1) === '1 semana seguida' && textoRacha(4) === '4 semanas seguidas', 'la racha, en palabras');
  check(JSON.stringify(mencionEnCurso('Hola @Rub')) === '{"inicio":5,"consulta":"Rub"}' && mencionEnCurso('Hola @Rubén M', 13)?.consulta === 'Rubén M' && mencionEnCurso('correo@fbe') === null && mencionEnCurso('@') ?.consulta === '' && mencionEnCurso('@Ana hola que tal') === null,
    'la mención que se está escribiendo (no un correo, ni lo que ya acabó)');
  const gente = [{ perfil_id: 'a', nombre: 'Ana L.' }, { perfil_id: 'r', nombre: 'Rubén M.' }, { perfil_id: 'c', nombre: 'Pelayo', coach: true }, { perfil_id: 'l', nombre: 'Lucía F.' }];
  check(sugerenciasMencion('ru', gente, 'a').map((x) => x.perfil_id).join() === 'r' && sugerenciasMencion('luc', gente).map((x) => x.nombre).join() === 'Lucía F.'
    && sugerenciasMencion('', gente, 'a').map((x) => x.perfil_id).join() === 'c,l,r' && sugerenciasMencion('m.', gente).map((x) => x.perfil_id).join() === 'r', 'propone por el principio de cualquier palabra, sin tildes, sin uno mismo y el coach primero');
  const ins = insertarMencion('Hola @Rub y más', { inicio: 5, consulta: 'Rub' }, 'Rubén M.');
  check(ins.texto === 'Hola @Rubén M. y más' && ins.cursor === 15, 'elegir a alguien pone «@Nombre » y deja el cursor detrás');
  check(mencionesDeTexto('Hola @Rubén M. y @Ana L.', [gente[1], gente[0], gente[3], gente[1]]).join() === 'r,a', 'solo van las menciones que siguen en el texto (sin repetir)');
  check(mencionesDeTexto('x', []).length === 0 && mencionesDeTexto(gente.map((p) => `@${p.nombre}`).join(' ') + ' @Uno @Dos', [...gente, { perfil_id: 'u', nombre: 'Uno' }, { perfil_id: 'd', nombre: 'Dos' }]).length === 5, 'como mucho 5');
  const tr = trozosConMenciones('Hola @Ana L. y @Ana, @Rubén M.', [{ perfil_id: 'r', nombre: 'Rubén M.' }, { perfil_id: 'a', nombre: 'Ana L.' }]);
  check(tr.map((t) => (t.perfil_id ? `[${t.texto}]` : t.texto)).join('') === 'Hola [@Ana L.] y @Ana, [@Rubén M.]' && trozosConMenciones('Hola @Ana L.', []).length === 1, '«@Nombre» resaltado solo para quien está mencionado de verdad');
  check(encuestaCerrada({ cierre: new Date(Date.now() - 1000).toISOString() }) && !encuestaCerrada({ cierre: null }) && !encuestaCerrada({ cierre: new Date(Date.now() + 864e5).toISOString() }), 'una encuesta, cerrada solo tras su cierre');
  const r = resultadosEncuesta({ opciones: ['a', 'b', 'c'] }, [{ autor_id: 1, opcion: 0 }, { autor_id: 2, opcion: 1 }, { autor_id: 3, opcion: 2 }, { autor_id: 4, opcion: 9 }], 2, (id) => `P${id}`);
  check(r.total === 3 && r.conteos.join() === '1,1,1' && r.porcentajes.reduce((a, x) => a + x, 0) === 100 && r.miVoto === 1 && r.quien[2].join() === 'P3', 'los resultados: cuántos, % que suman 100, mi voto y quién (un voto raro no cuenta)');
  check(resultadosEncuesta({ opciones: ['a', 'b'] }, [], null).porcentajes.join() === '0,0', 'sin votos, 0 %');
  check(limpiarEncuesta({ pregunta: ' ¿Sí? ', opciones: [' Sí', 'No', ''] }).encuesta.opciones.join() === 'Sí,No' && limpiarEncuesta({ pregunta: '¿Sí?', opciones: ['Sí'] }).error
    && limpiarEncuesta({ pregunta: '¿Sí?', opciones: ['Sí', 'SÍ'] }).error && limpiarEncuesta({ pregunta: '¿Sí?', opciones: ['a', 'b'], cierre: '2020-01-01T10:00' }).error
    && limpiarEncuesta({ pregunta: '', opciones: ['a', 'b'] }).error && limpiarEncuesta({ pregunta: '¿?', opciones: ['a', 'b', 'c', 'd', 'e'] }).error, 'una encuesta, como la base: pregunta, de 2 a 4 opciones distintas y el cierre en el futuro');
  const reto = { desde: '2026-10-01', hasta: '2026-10-31', objetivo: 8, modo: 'individual' };
  check(retoConseguido(reto, { hechas: 8, desde: '2026-10-15' }) && !retoConseguido(reto, { hechas: 7 }) && !retoConseguido(reto, { hechas: 9, desde: '2026-11-02' })
    && retoConseguido({ ...reto, modo: 'equipo' }, { hechas: 0, total: 8 }) && !retoConseguido({ ...reto, modo: 'equipo' }, { hechas: 20, total: 7 }), 'un reto conseguido, como la base (individual, de equipo; no el que acabó antes de entrar)');
  check(FILTROS_MURO.map(([k]) => k).join() === 'todo,entrenos,logros,avisos,mio', 'los filtros del muro');
  const { fechaMadrid } = await import('../web/src/logica/fechas.js');
  check(fechaMadrid(new Date('2026-11-01T23:30:00Z')) === '2026-11-02' && fechaMadrid(new Date('2026-07-01T21:59:00Z')) === '2026-07-01' && fechaMadrid(new Date('2026-07-01T22:01:00Z')) === '2026-07-02',
    'el día en Madrid, como la base (invierno y verano), sea cual sea la zona del navegador');
}

console.log('\nv0.48: tareas del coach');
{
  const { limpiarTarea, limpiarRespuesta, estadoTarea, cuandoTarea, tareasDelDia, resumenTareas, TIPOS_TAREA } = await import('../web/src/logica/tareas.js');
  const hoy = '2026-11-04';
  const lanza = (f) => { try { f(); return false; } catch { return true; } };
  check(TIPOS_TAREA.map(([t]) => t).join() === 'foto,medida,video,texto', 'cuatro tipos: foto de progreso, peso o medidas, vídeo de técnica y texto (como la base)');
  check(igual(limpiarTarea({ tipo: 'texto', titulo: '  ¿Qué  tal? ', detalle: '  ', fecha: hoy, ejercicio_id: 'x' }), { tipo: 'texto', titulo: '¿Qué tal?', detalle: null, ejercicio_id: null, fecha: hoy }),
    'limpia el título, quita un detalle vacío y el ejercicio de lo que no es un vídeo');
  check(lanza(() => limpiarTarea({ tipo: 'video', titulo: 'Vídeo', fecha: hoy })) && lanza(() => limpiarTarea({ tipo: 'nada', titulo: 'x', fecha: hoy }))
    && lanza(() => limpiarTarea({ tipo: 'foto', titulo: '​ ', fecha: hoy })) && lanza(() => limpiarTarea({ tipo: 'foto', titulo: 'x'.repeat(121), fecha: hoy }))
    && lanza(() => limpiarTarea({ tipo: 'foto', titulo: 'x', fecha: '2026-13' })), 'rechaza un vídeo sin ejercicio, un tipo inventado, un título invisible o largo y una fecha mal escrita');
  check(limpiarRespuesta('  ') === null && limpiarRespuesta(' Bien ') === 'Bien' && lanza(() => limpiarRespuesta('x'.repeat(501))), 'la respuesta del atleta: vacía es ninguna; como mucho 500 letras');
  const t = (fecha, extra = {}) => ({ id: fecha + (extra.id || ''), titulo: 'T', tipo: 'texto', fecha, hecha_en: null, creada_en: `${fecha}T08:00:00Z`, ...extra });
  check(estadoTarea(t(hoy), hoy) === 'pendiente' && estadoTarea(t('2026-11-01'), hoy) === 'atrasada' && estadoTarea(t('2026-11-09'), hoy) === 'proxima'
    && estadoTarea(t('2026-11-01', { hecha_en: '2026-11-02T10:00:00Z' }), hoy) === 'hecha', 'cada tarea, pendiente (hoy), atrasada, próxima o hecha');
  check(cuandoTarea(t(hoy), hoy) === 'Para hoy' && cuandoTarea(t('2026-11-03'), hoy) === 'Desde ayer' && cuandoTarea(t('2026-11-02'), hoy) === 'Desde el lun'
    && cuandoTarea(t('2026-10-20'), hoy) === 'Desde el 20 oct' && cuandoTarea(t('2026-11-06'), hoy).startsWith('Para el vie'), 'las atrasadas, sin agobiar: «Desde ayer», «Desde el lun», «Desde el 20 oct»');
  const lista = [t('2026-11-06'), t(hoy), t('2026-11-01'), t('2026-10-30', { hecha_en: '2026-11-04T09:00:00Z' }), t('2026-10-29', { id: 'v', hecha_en: '2026-11-02T09:00:00Z' })];
  check(igual(tareasDelDia(lista, hoy).map((x) => x.fecha), ['2026-11-01', hoy, '2026-10-30']), '«Tu día»: las que ya tocan (la más antigua primero) y las hechas hoy; ni las de otro día hechas ni las que aún no tocan');
  const r = resumenTareas([...lista, t('2026-10-28', { id: 'r', hecha_en: '2026-10-29T09:00:00Z', revisada_en: '2026-10-29T10:00:00Z' })], hoy);
  check(r.pendiente === 1 && r.atrasada === 1 && r.proxima === 1 && r.hecha === 3 && r.porRevisar === 2, 'el coach ve cuántas hay de cada y cuántas hechas faltan por revisar');
  const dia = tuDia({ tareas: lista }, hoy);
  check(dia.filter((x) => x.accion === 'tarea').length === 3 && dia.find((x) => x.id === `tarea-${hoy}`).estado === 'toca' && dia.find((x) => x.accion === 'tarea' && x.estado === 'hecho')?.detalle === 'Tarea hecha'
    && dia.find((x) => x.id === 'tarea-2026-11-01').detalle === 'Texto. Desde el dom', 'salen en «Tu día» con su tipo y desde cuándo, las hechas hoy como hechas');
}

console.log('\nv0.48: ¿dónde entrenas hoy? (material de cada ejercicio)');
{
  const { materialNecesario, sePuedeCon, adaptarSesion, textoAdaptacion, PERFILES_DEFECTO } = await import('../web/src/logica/material.js');
  const m = (n) => JSON.stringify(materialNecesario(n));
  check(m('Press banca') === '[["barra","banco"]]' && m('Sentadilla barra alta') === '[["barra","rack"]]' && m('Press inclinado con mancuernas') === '[["mancuernas","banco"]]'
    && m('Remo con barra') === '[["barra"]]' && m('Jalón al pecho prono') === '[["poleas"]]' && m('Leg curl tumbado') === '[["maquinas"]]', 'el material de cada ejercicio sale de su nombre (con su banco o su rack)');
  check(m('Seal row con barra/mancuernas') === '[["mancuernas","banco"],["barra","banco"]]' && m('Remo al mentón en MP/con barra/en polea baja') === '[["multipower"],["poleas"],["barra"]]',
    'si el nombre da a elegir, vale cualquiera');
  check(m('Extensiones desde polea alta con barra V1/2/3') === '[["poleas"]]' && m('Dominadas pronas') === '[["dominadas"]]' && m('Ab wheel') === '[]' && m('Zancadas') === '[]'
    && materialNecesario('Leg raises en banco declinado') === null, 'la barra de una polea no es la barra libre; sin material, nada; si no se sabe, null (no se toca)');
  check(sePuedeCon('Press plano con mancuernas', PERFILES_DEFECTO.casa) && !sePuedeCon('Press banca', PERFILES_DEFECTO.casa) && sePuedeCon('Leg raises en banco declinado', []), 'se puede con el material de casa o no; lo que no se sabe, se deja');
  const alt = (id, nombre) => ({ id, nombre, activo: true });
  const ejs = [
    { id: 'p1', ejercicio: alt('e1', 'Press banca'), alternativas: [alt('e2', 'Press plano en máquina'), alt('e3', 'Press plano con mancuernas')], hechas: [] },
    { id: 'p2', ejercicio: alt('e4', 'Leg curl tumbado'), alternativas: [alt('e5', 'Leg curl sentado')], hechas: [] },
    { id: 'p3', ejercicio: alt('e6', 'Curl martillo con mancuernas'), alternativas: [], hechas: [] },
    { id: 'p4', ejercicio: alt('e7', 'Sentadilla barra alta'), alternativas: [alt('e8', 'Búlgara con mancuernas+apoyo')], hechas: [{ numero: 1 }] },
    { id: 'p5', ejercicio: alt('e9', 'Remo con barra'), alternativas: [alt('e10', 'Remo con mancuerna a una mano')], hechas: [] },
    { id: 'p6', ejercicio: alt('e11', 'Face pull'), alternativas: [{ ...alt('e12', 'Pájaros con mancuernas de pie apoyado en banco'), activo: false }], hechas: [] },
  ];
  const r = adaptarSesion(ejs, PERFILES_DEFECTO.casa, { fijos: new Set(['p5']) });
  check(r.cambios.p1?.id === 'e3' && !r.cambios.p2 && r.sinAlternativa.includes('p2') && !r.cambios.p3 && !r.cambios.p4 && !r.cambios.p5 && r.sinAlternativa.includes('p6'),
    'cambia por la primera alternativa del coach que se puede hacer; sin ninguna, se queda y se avisa; no toca lo que ya se puede, lo que tiene series ni lo cambiado a mano (ni usa alternativas desactivadas)');
  check(textoAdaptacion(r, 'casa') === '1 ejercicio cambiado por tu material; 2 sin alternativa con tu material' && textoAdaptacion({ cambios: {}, sinAlternativa: [] }, 'viaje') === 'Todo se puede hacer con tu material de viaje', 'y lo dice en una línea');
}

console.log('\nv0.48: entrenador por voz, enlaces y hora de Madrid');
{
  const { fraseSerie, fraseCuenta, elegirVoz } = await import('../web/src/logica/voz.js');
  check(fraseSerie({ numero: 3, series: 4, nombre: 'Press banca', kg: 80, reps: 6 }) === 'Serie 3 de press banca: 80 kilos por 6.'
    && fraseSerie({ numero: 4, series: 4, nombre: 'Press banca', kg: 22.5, reps: 8 }) === 'Serie 4 de press banca: 22,5 kilos por 8. Última serie.'
    && fraseSerie({ numero: 1, series: 3, nombre: 'Dominadas pronas', kg: null, reps: 6 }) === 'Serie 1 de dominadas pronas: 6 repeticiones.', 'la frase de la serie siguiente (con decimales a la española y «Última serie»)');
  check(fraseCuenta(10) === 'Diez segundos' && fraseCuenta(2) === 'Dos' && fraseCuenta(5) === null, 'la cuenta de los últimos segundos');
  check(elegirVoz([{ lang: 'en-US' }, { lang: 'es-MX' }, { lang: 'es-ES', name: 'x' }])?.lang === 'es-ES' && elegirVoz([{ lang: 'en-GB' }]) === null, 'la voz de España si la hay');
  const { idYoutube, trozosConEnlaces, videosYoutube, miniaturaYoutube } = await import('../web/src/logica/enlaces.js');
  check(idYoutube('https://www.youtube.com/watch?v=gMgvBspQ9lk') === 'gMgvBspQ9lk' && idYoutube('https://youtu.be/gMgvBspQ9lk?t=10') === 'gMgvBspQ9lk'
    && idYoutube('https://m.youtube.com/shorts/gMgvBspQ9lk') === 'gMgvBspQ9lk' && idYoutube('https://youtube.com.evil.test/watch?v=gMgvBspQ9lk') === null
    && idYoutube('javascript:alert(1)') === null && idYoutube('https://www.youtube.com/watch?v=corto') === null, 'el vídeo de YouTube de un enlace (watch, youtu.be, shorts); nada de otros sitios ni ids raros');
  const tr = trozosConEnlaces('Mira esto: https://youtu.be/gMgvBspQ9lk. Y https://fbe.test/guia');
  check(tr.length === 4 && tr[1].youtube === 'gMgvBspQ9lk' && tr[1].valor === 'https://youtu.be/gMgvBspQ9lk' && tr[2].valor === '. Y ' && tr[3].youtube === null && videosYoutube('https://youtu.be/gMgvBspQ9lk https://youtu.be/gMgvBspQ9lk').length === 1
    && miniaturaYoutube('gMgvBspQ9lk') === 'https://i.ytimg.com/vi/gMgvBspQ9lk/mqdefault.jpg', 'el texto en trozos (sin la puntuación del final) y la miniatura de i.ytimg.com');
  const { instanteMadrid, partesMadrid, fmtProgramado } = await import('../web/src/logica/fechas.js');
  check(instanteMadrid('2026-11-02', '08:00') === '2026-11-02T07:00:00.000Z' && instanteMadrid('2026-07-02', '08:00') === '2026-07-02T06:00:00.000Z' && instanteMadrid('2026-11-02', '25:00') === null,
    'el instante de un día y una hora de Madrid, en invierno y en verano');
  check(partesMadrid('2026-11-02T07:00:00Z').hora === '08:00' && fmtProgramado('2026-11-02T07:00:00Z') === 'lun 2 nov, 8:00', '«lun 2 nov, 8:00»');
}

console.log('\nv0.48: tu mes, tu bloque, comparar check-ins y el panel de negocio');
{
  const { resumenMes, calendarioMes, datosCompartirMes, mesAnterior, nombreMes, ultimoDia, sumarMes } = await import('../web/src/logica/mes.js');
  check(mesAnterior(new Date('2026-11-01T00:30:00+01:00')) === '2026-10' && mesAnterior(new Date('2026-10-31T23:30:00Z')) === '2026-10' && ultimoDia('2026-02') === '2026-02-28' && sumarMes('2026-01', -1) === '2025-12' && nombreMes('2026-10') === 'octubre',
    'el mes que se resume es el anterior al de hoy en Madrid (el día 1 ya sale octubre)');
  const s = (sem, i, fecha, completada = true, extra = {}) => ({ id: `${sem}-${i}`, semana_lunes: sem, completada, fecha_realizada: completada ? fecha : null, duracion_min: 60, ...extra });
  const sesiones = [s('2026-09-28', 1, '2026-09-29'), s('2026-09-28', 2, '2026-10-01'), s('2026-10-05', 1, '2026-10-06'), s('2026-10-05', 2, '2026-10-08'),
    s('2026-10-12', 1, '2026-10-13'), s('2026-10-12', 2, null, false), s('2026-10-26', 1, '2026-10-27', true, { cardio_hecho: { modalidad: 'carrera', minutos: 30, km: 5.2 } }), s('2026-10-26', 2, '2026-11-01')];
  const serie = (fecha, kg, reps, sesion, ej = 'e1') => ({ fecha, kg, reps, rpe: 8, sesion_id: sesion, ejercicio_id: ej, ejercicio: 'Press', registrada_en: `${fecha}T18:00:00Z` });
  const series = [serie('2026-09-22', 60, 5, 'x'), serie('2026-10-06', 62.5, 5, '2026-10-05-1'), serie('2026-10-06', 62.5, 5, '2026-10-05-1'), serie('2026-10-13', 65, 5, '2026-10-12-1'), serie('2026-11-01', 70, 5, '2026-10-26-2')];
  const h = { id: 'h', nombre: 'Pasos', tipo: 'numero', objetivo: 8000, sentido: 'al_menos', dias_semana: 7, icono: 'pasos', creado_en: '2026-10-25T09:00:00Z' };
  const reg = Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-10-${25 + i}`, valor: i % 2 ? 9000 : 5000 }));
  const nut = { planes: [{ desde: '2026-09-01', modo: 'sin_contar' }], registros: [{ fecha: '2026-10-10', cumplido: 2 }, { fecha: '2026-10-11', cumplido: 1 }, { fecha: '2026-11-01', cumplido: 2 }] };
  const r = resumenMes({ series, sesiones, habitos: [{ habito: h, registros: reg }], nutricion: nut }, '2026-10');
  check(r.sesiones.hechas === 5 && r.sesiones.previstas === 8 && r.dias === 5, `octubre: sesiones hechas en el mes (${r.sesiones.hechas}) frente a las previstas de sus semanas (${r.sesiones.previstas}: las semanas cuentan para el mes de su jueves) y días entrenados (${r.dias})`);
  check(r.series === 3 && r.tonelaje === 62.5 * 10 + 65 * 5 && r.records.length === 2 && r.cardio.minutos === 30 && r.cardio.km === 5.2 && r.minutos === 300, 'series, tonelaje, récords del mes y el cardio (km y minutos)');
  check(r.mejorRacha === 2 && r.semanasCompletas === 3, `la mejor racha de semanas completas del mes (${r.mejorRacha}) y cuántas completas (${r.semanasCompletas})`);
  check(r.habitos?.media === Math.round((3 / 7) * 100) && r.nutricion?.dias === 2 && r.nutricion.bien === 1 && r.nutricion.cerca === 1, 'hábitos (desde que existe el hábito) y nutrición del mes, frente a su plan');
  check(resumenMes({ series, sesiones, habitos: [{ habito: h, registros: reg }], nutricion: nut }, '2026-10', { salud: false }).habitos === null
    && resumenMes({ series, sesiones, nutricion: nut }, '2026-10', { conNutricion: false }).nutricion === null && resumenMes({}, '2026-10').vacio, 'sin consentimiento de salud, sin hábitos ni nutrición; un mes sin nada, vacío');
  const cal = calendarioMes('2026-10', r.diasEntrenados);
  check(cal.length === 5 && cal[0][0].iso === '2026-09-28' && cal[0][0].fuera && cal[1][1].entrenado && cal.flat().filter((d) => d.entrenado).length === 5, 'el calendario del mes: semanas de lunes a domingo, con los días entrenados');
  const img = datosCompartirMes(r);
  check(!JSON.stringify(img).match(/habitos|nutricion|peso|medida|kcal/) && img.sesiones === 5 && img.records === 2 && img.calendario.length === 5, 'la imagen para compartir no lleva hábitos, nutrición, peso ni medidas');

  const { vistaBloque } = await import('../web/src/logica/bloque.js');
  const todas = [{ numero: 1, fecha_inicio: '2026-10-19', publicada: true }, { numero: 2, fecha_inicio: '2026-10-26', publicada: true }, { numero: 3, fecha_inicio: '2026-11-02', publicada: false }];
  const semanas = [{ id: 'w1', numero: 1, fecha_inicio: '2026-10-19', foco: 'volumen' }, { id: 'w2', numero: 2, fecha_inicio: '2026-10-26', foco: 'descarga' }];
  const ses = { w1: [{ id: 's1', nombre: 'A', completada: true, orden: 1 }, { id: 's2', nombre: 'B', completada: true, orden: 2 }], w2: [{ id: 's3', nombre: 'A', completada: true, orden: 1 }, { id: 's4', nombre: 'B', completada: false, orden: 2 }] };
  const pautas = [{ id: 'p1', sesion_id: 's1', ejercicio_id: 'e1', prioridad: 'alta', carga_sugerida_kg: 60 }, { id: 'p3', sesion_id: 's3', ejercicio_id: 'e1', prioridad: 'alta', carga_sugerida_kg: 55, series_detalle: [{ kg: 57.5 }, { kg: 55 }] },
    { id: 'px', sesion_id: 's2', ejercicio_id: 'e2', prioridad: 'media', carga_sugerida_kg: 20 }];
  const v = vistaBloque({ bloque: { id: 'b' }, todas, semanas, sesiones: ses, pautas, series: [{ sesion_ejercicio_id: 'p1', kg: 60, reps: 5 }, { sesion_ejercicio_id: 'p1', kg: 62.5, reps: 3 }, { sesion_ejercicio_id: 'p3', kg: 80, reps: 5, sustituto_id: 'otro' }], ejercicios: { e1: { nombre: 'Press' } } }, '2026-10-29');
  check(v.semanas.map((w) => w.estado).join() === 'hecha,actual,por_publicar' && v.semanas[2].sesiones.length === 0 && v.semanas[2].foco === null && v.semanas[1].descarga && v.hechas === 3 && v.total === 4 && v.porPublicar === 1,
    'el bloque entero: hechas, la actual y las por publicar (sin nada de lo que llevan)');
  check(v.principales.length === 1 && igual(v.principales[0].puntos, [{ numero: 1, pautado: 60, hecho: 62.5 }, { numero: 2, pautado: 57.5, hecho: null }]),
    'de los obligatorios, lo pautado (también serie a serie) y lo hecho cada semana (lo hecho con otro ejercicio no cuenta)');

  const { compararCheckins } = await import('../web/src/logica/comparar.js');
  const c1 = { id: 'c1', semana_inicio: '2026-10-05', energia: 3, horas_sueno: '6-7', respuestas: { q: 2 }, notas: 'Cansada' };
  const c2 = { id: 'c2', semana_inicio: '2026-10-26', energia: 4, horas_sueno: '7-8', respuestas: { q: 4 } };
  const cmp = compararCheckins(c2, c1, {
    pesos: [{ fecha: '2026-10-06', kg: 63.2 }, { fecha: '2026-10-27', kg: 62.4 }], medidas: [{ fecha: '2026-10-07', cintura_cm: 74.5 }, { fecha: '2026-11-02', cintura_cm: 73.4 }],
    preguntas: { q: { id: 'q', texto: 'Estrés', tipo: 'escala', atleta_id: null, activa: true, orden: 0 } }, fotos: [{ id: 'f1', fecha: '2026-10-06', pose: 'frente' }, { id: 'f2', fecha: '2026-10-29', pose: 'frente' }],
  });
  const fila = (k) => cmp.filas.find((f) => f.clave === k);
  check(cmp.antes.checkin.id === 'c1' && fila('peso').dif === -0.8 && fila('peso').difTexto === '−0,8 kg' && fila('cintura_cm').b === 73.4 && fila('energia').dif === 1 && fila('p-q').a === 2 && fila('p-q').b === 4,
    'comparar dos check-ins: en orden, el peso y las medidas de esas semanas (o de 3 días alrededor) con su diferencia y cada respuesta');
  check(cmp.antes.fotos[0].id === 'f1' && cmp.despues.fotos[0].id === 'f2' && fila('notas').a === 'Cansada' && !fila('pasos'), 'y las fotos de esos días; lo que no hay, no sale');

  const { panelNegocio, euros, OCULTO } = await import('../web/src/logica/negocio.js');
  const hoy = '2026-11-01';
  const at = [{ id: 'a', nombre: 'Ana', estado: 'activo', fecha_alta: '2026-08-24' }, { id: 'b', nombre: 'Bea', estado: 'activo', fecha_alta: '2026-10-03', nutricion: false },
    { id: 'c', nombre: 'Cris', estado: 'baja', fecha_alta: '2026-03-01', baja_en: '2026-09-10' }, { id: 'd', nombre: 'Dani', estado: 'baja', fecha_alta: '2025-01-01', baja_en: null }];
  const acuerdos = [{ atleta_id: 'a', servicio: 'Performance', precio_mes: 75, ciclo: 'trimestral', desde: '2026-08-24' }, { atleta_id: 'b', servicio: 'Essential', precio_mes: 49, ciclo: 'mensual', desde: '2026-10-03' }];
  const pagos = [{ atleta_id: 'a', periodo_desde: '2026-08-24', periodo_hasta: '2026-11-23', importe: 225, estado: 'pagado', fecha_pago: '2026-08-26' },
    { atleta_id: 'b', periodo_desde: '2026-10-03', periodo_hasta: '2026-11-02', importe: 49, estado: 'pagado', fecha_pago: '2026-10-04' },
    { atleta_id: 'b', periodo_desde: '2026-11-03', periodo_hasta: '2026-12-02', importe: 49, estado: 'pendiente', fecha_pago: null },
    { atleta_id: 'c', periodo_desde: '2026-08-01', periodo_hasta: '2026-08-31', importe: 1308, estado: 'pagado', fecha_pago: '2026-08-02' }];
  const n = panelNegocio({ atletas: at, acuerdos, pagos, constancia: [100, 75, 50] }, hoy);
  const mes = (m) => n.meses.find((x) => x.mes === m);
  check(n.activos === 2 && n.porServicio.map((x) => x.nombre).join() === 'Essential,Performance' && n.porTipo.some((t) => t.nombre === 'Solo entrenamiento' && t.n === 1) && n.mrr === 124,
    'atletas activos por servicio y por lo que les llevas, y lo que pagan al mes');
  check(n.meses.length === 12 && n.meses[11].mes === '2026-11' && mes('2026-08').cobrado === 1533 && mes('2026-08').previsto === 1533 && mes('2026-10').cobrado === 49 && mes('2026-11').previsto === 49 && n.cobrado12 === 1582,
    'cobrado y previsto de los últimos 12 meses (por fecha de pago y por periodo)');
  check(mes('2026-08').altas === 1 && mes('2026-10').altas === 1 && mes('2026-09').bajas === 1 && n.bajasSinFecha === 1, 'altas y bajas por mes (las bajas sin fecha, aparte)');
  check(n.renovaciones.length === 2 && n.renovaciones[0].atleta.id === 'b' && n.renovaciones[0].apuntado && n.renovaciones[0].importe === 49 && n.renovaciones[1].atleta.id === 'a' && n.renovaciones[1].fecha === '2026-11-24' && n.renovaciones[1].importe === 225
    && n.constanciaMedia === 75, 'lo que renueva en 30 días (el cobro apuntado o el final del periodo, con su importe) y la constancia media del equipo');
  check(euros(1308) === '1.308 €' && euros(74.5) === '74,50 €' && euros(1308, true) === OCULTO, 'los euros a la española («1.308 €») o tapados');
}

// ---------- v0.49: piezas visuales ----------
{
  const { resumenSeries, compararConAnterior, textoComparacion, escalaGrafica, puntoMasCercano, indicesRecord, mapaConstancia, estadoAtleta, chispaPeso, chispaSesiones, trazoChispa, gruposChat } = await import('../web/src/logica/visual.js');
  const { ACENTOS, ACENTO_DEFECTO, contraste, parejasAcento, acentoValido, cssAcento, SUPERFICIES } = await import('../web/src/logica/acentos.js');
  const { PATRONES } = await import('../web/src/ui/hapticos.js');
  console.log('\nv0.49: resumen de un ejercicio plegado');
  check(resumenSeries([{ kg: 42.5, reps: 6 }, { kg: 42.5, reps: 6 }, { kg: 42.5, reps: 6 }]) === '3 × 6 @ 42,5 kg', 'mismas series: «3 × 6 @ 42,5 kg»');
  check(resumenSeries([{ kg: 40, reps: 6 }, { kg: 40, reps: 6 }, { kg: 40, reps: 5 }]) === '6-6-5 @ 40 kg', 'mismos kilos, repeticiones distintas: «6-6-5 @ 40 kg»');
  check(resumenSeries([{ kg: 42.5, reps: 6 }, { kg: 37.5, reps: 6 }, { kg: 37.5, reps: 6 }]) === '3 series, hasta 42,5 kg', 'top y back-off: «3 series, hasta 42,5 kg»');
  check(resumenSeries([{ kg: null, reps: 12 }, { kg: 0, reps: 12 }]) === '2 × 12' && resumenSeries([{ reps: 10 }, { reps: 8 }]) === '10-8 reps', 'sin carga: «2 × 12» o «10-8 reps»');
  check(resumenSeries([]) === '' && resumenSeries([{}]) === '', 'sin series, nada');

  console.log('\nv0.49: comparación con la última vez que hizo la sesión');
  const ent = [
    { id: 's3', nombre: 'Torso A', fecha: '2026-10-27', tonelaje: 9999, series: 17, duracion_min: 70 },
    { id: 's2', nombre: 'Torso A', fecha: '2026-10-20', tonelaje: 4880, series: 16, duracion_min: 62 },
    { id: 's1', nombre: 'Torso A', fecha: '2026-10-13', tonelaje: 4500, series: 16, duracion_min: 60 },
    { id: 'p2', nombre: 'Pierna A', fecha: '2026-10-22', tonelaje: 8000, series: 15 },
    { id: 's0', nombre: 'torso a ', fecha: '2026-10-06', tonelaje: 4000, series: 0 },
  ];
  const c1 = compararConAnterior({ id: 's3', nombre: 'Torso A', fecha: '2026-10-27', tonelaje: 5000, series: 17, minutos: 65 }, ent);
  check(c1 && c1.fecha === '2026-10-20' && c1.tonelaje === 120 && c1.series === 1 && c1.minutos === 3, 'compara con la anterior del mismo nombre (sin contarse a sí misma)');
  check(textoComparacion(c1) === '+120 kg de tonelaje que la última vez', '«+120 kg de tonelaje que la última vez»');
  check(textoComparacion({ tonelaje: -1340 }) === '1340 kg menos de tonelaje que la última vez' && textoComparacion({ tonelaje: 0.4 }) === 'El mismo tonelaje que la última vez', 'también cuando baja o se queda igual');
  check(compararConAnterior({ id: 'x', nombre: 'Torso B', fecha: '2026-10-27', tonelaje: 1, series: 1 }, ent) === null && textoComparacion(null) === null, 'la primera vez no hay comparación');
  check(compararConAnterior({ id: 'x', nombre: 'Torso A', fecha: '2026-10-10', tonelaje: 4600, series: 16 }, ent) === null, 'no cuenta las de después ni las que no tienen series');
  check(compararConAnterior({ id: 'x', nombre: 'torso á', fecha: '2026-10-14', tonelaje: 4600, series: 16 }, ent)?.tonelaje === 100, 'el nombre se compara sin tildes ni mayúsculas');

  console.log('\nv0.49: escala y récords de las gráficas');
  const e1 = escalaGrafica([80, 90, 100]);
  check(Math.abs(e1.lo - 77) < 1e-9 && Math.abs(e1.hi - 103) < 1e-9 && igual(e1.ticks, [82, 98]), `márgenes del 15 % y dos guías redondeadas (${e1.lo}–${e1.hi}, ${e1.ticks})`);
  const e2 = escalaGrafica([2000, 2080], { rangoMin: 400 });
  check(e2.hi - e2.lo >= 400 && e2.lo < 2000 && e2.hi > 2080, 'con rangoMin, el eje abarca como poco eso (2000 → 2080 kcal no es una montaña)');
  const e3 = escalaGrafica([50, 50]);
  check(e3.hi - e3.lo > 2 && e3.lo < 50 && e3.hi > 50, 'un valor repetido no deja el eje sin alto');
  check(igual(escalaGrafica([]), { lo: 0, hi: 1, ticks: [] }), 'sin datos, una escala vacía');
  check(puntoMasCercano([10, 50, 90], 62) === 1 && puntoMasCercano([10, 50, 90], 75) === 2 && puntoMasCercano([10, 50, 90], -5) === 0 && puntoMasCercano([], 3) === -1, 'el dedo elige el punto más cercano');
  check(igual(indicesRecord([100, 105, 103, 105, 110, 90, 111]), [1, 4, 6]), 'récords: los que superan a todos los anteriores (igualar no cuenta; el primero tampoco)');

  console.log('\nv0.49: calendario de constancia (16 semanas)');
  const hoyC = '2026-11-01'; // domingo
  const ses = [{ fecha: '2026-11-01', nombre: 'Torso A' }, { fecha: '2026-10-28', nombre: 'Pierna A' }, { fecha: '2026-10-28', nombre: 'Cardio' }, { fecha: '2026-07-12', nombre: 'Vieja' }, { fecha: '2026-11-03', nombre: 'Futura' }];
  const mc = mapaConstancia(ses, hoyC, 16);
  const dia = (iso) => mc.semanas.flatMap((w) => w.dias).find((d) => d.iso === iso);
  check(mc.semanas.length === 16 && mc.semanas.every((w) => w.dias.length === 7) && mc.semanas[0].lunes === '2026-07-13' && mc.semanas[15].lunes === '2026-10-26', '16 columnas de lunes a domingo, la última la de hoy');
  check(dia('2026-11-01').nivel === 1 && dia('2026-10-28').nivel === 2 && dia('2026-10-28').sesiones.length === 2 && dia('2026-10-27').nivel === 0, 'nivel 0, 1 o 2+ por sesiones hechas ese día, con lo que se hizo');
  check(!dia('2026-07-12') && mc.diasActivos === 2 && mc.total === 3, 'lo de antes de las 16 semanas no cuenta (2 días, 3 sesiones)');
  const mc2 = mapaConstancia([{ fecha: '2026-10-29', nombre: 'X' }], '2026-10-29', 16);
  const d2 = mc2.semanas[15].dias;
  check(d2[3].nivel === 1 && d2[4].nivel === -1 && d2[6].nivel === -1, 'los días que aún no han llegado van aparte (nivel -1)');
  check(mc.meses[0].col === 0 && mc.meses.map((x) => x.texto).join() === 'jul,ago,sep,oct' && mc.meses.find((x) => x.texto === 'ago').col === 3, `meses en la columna donde empiezan (${mc.meses.map((x) => `${x.texto}@${x.col}`).join(' ')})`);
  const mc3 = mapaConstancia([], '2026-11-25', 16);
  check(mc3.meses[0].texto !== 'ago' || mc3.meses[1].col > 2, 'el primer mes se quita si el siguiente va justo detrás (no cabrían)');

  console.log('\nv0.49: panel del coach (franja y minigráficas)');
  check(estadoAtleta({ estado: 'invitado', alertas: [] }) === 'gris' && estadoAtleta({ estado: 'baja', alertas: [{ nivel: 'alerta' }] }) === 'gris', 'sin activar o de baja: gris');
  check(estadoAtleta({ estado: 'activo', alertas: [{ tipo: 'sin_entrenar', nivel: 'aviso' }] }) === 'rojo' && estadoAtleta({ estado: 'activo', alertas: [{ tipo: 'molestia', nivel: 'alerta' }] }) === 'rojo'
    && estadoAtleta({ estado: 'activo', alertas: [{ tipo: 'cumplimiento', nivel: 'aviso' }] }) === 'rojo', 'quedándose atrás (sin entrenar, poco cumplimiento) o algo grave: rojo');
  check(estadoAtleta({ estado: 'activo', alertas: [{ tipo: 'molestia', nivel: 'aviso' }, { tipo: 'sin_checkin', nivel: 'info' }] }) === 'ambar', 'necesita atención (los mismos avisos que el filtro del panel): ámbar');
  check(estadoAtleta({ estado: 'activo', alertas: [{ tipo: 'sin_checkin', nivel: 'info' }] }) === 'verde' && estadoAtleta({ estado: 'activo', alertas: [] }) === 'verde', 'solo avisos informativos: verde');
  const cp = chispaPeso([{ fecha: '2026-09-01', kg: 90 }, { fecha: '2026-09-15', kg: 82 }, { fecha: '2026-09-16', kg: 81 }, { fecha: '2026-10-28', kg: '80.4' }, { fecha: '2026-11-02', kg: 70 }], hoyC, 8);
  check(igual(cp, [{ x: '2026-09-14', y: 81.5 }, { x: '2026-10-26', y: 80.4 }]), 'peso: la media de cada semana de las 8 últimas (sin las de fuera ni las futuras)');
  const sem = [{ id: 'w1', fecha_inicio: '2026-10-19' }, { id: 'w2', fecha_inicio: '2026-10-26' }, { id: 'w0', fecha_inicio: '2026-09-01' }];
  const sp = chispaSesiones(sem, [{ semana_id: 'w1', completada: true }, { semana_id: 'w1', completada: true }, { semana_id: 'w1', completada: false }, { semana_id: 'w2', completada: true }, { semana_id: 'w0', completada: true }], hoyC, 6);
  check(sp.length === 6 && sp[0].lunes === '2026-09-21' && igual(sp[4], { lunes: '2026-10-19', hechas: 2, total: 3 }) && igual(sp[5], { lunes: '2026-10-26', hechas: 1, total: 1 }) && sp[1].total === 0,
    'sesiones: hechas de las programadas en cada una de las 6 últimas semanas');
  check(trazoChispa([1, 2, 3], 64, 20, 2) === 'M2.0 18.0 L32.0 10.0 L62.0 2.0' && trazoChispa([5, 5], 64, 20, 2) === 'M2.0 10.0 L62.0 10.0' && trazoChispa([]) === '', 'la línea de la minigráfica, de izquierda a derecha');

  console.log('\nv0.49: grupos del chat');
  const t0 = Date.parse('2026-11-01T10:00:00Z');
  const m = (id, autor, min, extra = {}) => ({ id, autor, creado_en: new Date(t0 + min * 60000).toISOString(), ...extra });
  const g = gruposChat([m('a', 'atleta', 0), m('b', 'atleta', 2), m('c', 'atleta', 6), m('d', 'atleta', 13), m('e', 'coach', 14), m('f', 'coach', 15, { programado: true }), m('g', 'coach', 16, { contexto: { tipo: 'sesion' } })]);
  const f = (id) => g.find((x) => x.id === id);
  check(f('a').primero && !f('a').ultimo && !f('b').primero && !f('b').ultimo && !f('c').primero && f('c').ultimo, 'seguidos y con menos de 5 minutos entre uno y otro: un grupo (solo el último lleva pico y hora)');
  check(f('d').primero && f('d').ultimo && f('e').primero, 'más de 5 minutos o cambio de persona: grupo nuevo');
  check(f('f').primero && f('f').ultimo && f('g').primero, 'los programados y los que llevan etiqueta van solos');
  const g2 = gruposChat([m('x', 'atleta', 0), m('y', 'atleta', 1)], { dia: (iso) => (iso < new Date(t0 + 30000).toISOString() ? 'ayer' : 'hoy') });
  check(g2[0].ultimo && g2[1].primero, 'el cambio de día corta el grupo');

  console.log('\nv0.49: colores de acento (contraste AA en claro, oscuro y negro puro)');
  check(ACENTOS.length === 6 && ACENTOS[0].id === ACENTO_DEFECTO && ACENTO_DEFECTO === 'morado' && new Set(ACENTOS.map((a) => a.id)).size === 6, 'seis acentos, el morado FBE el primero y de serie');
  check(contraste('#000000', '#FFFFFF') === 21 && contraste('#FFFFFF', '#FFFFFF') === 1 && contraste('#5438D8', '#FFFFFF') === contraste('#FFFFFF', '#5438D8'), 'el contraste WCAG (21:1 negro sobre blanco, simétrico)');
  for (const a of ACENTOS) {
    for (const tema of ['claro', 'oscuro', 'oled']) {
      const ps = parejasAcento(a, tema);
      const peor = ps.reduce((x, y) => (y.ratio < x.ratio ? y : x));
      check(ps.length === Object.keys(SUPERFICIES[tema]).length + 4 && ps.every((x) => x.ratio >= 4.5), `${a.nombre} en ${tema}: todo ≥ 4,5:1 (el peor, ${peor.que}: ${peor.ratio}:1)`);
    }
    check(acentoValido(a), `${a.nombre}: válido como texto, en botones y en la tarjeta del día`);
  }
  check(cssAcento('morado') === '' && cssAcento('azul').includes('--morado:#1D55C4') && cssAcento('azul').includes(':root[data-theme="dark"]{--morado:#7EA6FF') && cssAcento('azul').includes('prefers-color-scheme: dark'),
    'el CSS de un acento: claro, oscuro del sistema y oscuro elegido (el morado no necesita nada)');
  check(cssAcento('no-existe') === '', 'un acento que no existe se queda en el morado');
  console.log('\nv0.49 (revisión): ajustes guardados, series pautadas y el calendario');
  const { normalizarAjustes, AJUSTES_DEFECTO } = await import('../web/src/ui/ajustes.js');
  check(normalizarAjustes({ vibracion: false }).hapticos === false && normalizarAjustes({ vibracion: true }).hapticos === true, 'quien apagó la vibración en la v0.48 la tiene apagada también al tocar (y quien la tenía, encendida)');
  check(normalizarAjustes({ vibracion: false, hapticos: true }).hapticos === true && normalizarAjustes({ vibracion: true, hapticos: false }).hapticos === false, 'lo elegido después en «Vibración al tocar» manda');
  check(normalizarAjustes({}).hapticos === true && normalizarAjustes(null).hapticos === true && AJUSTES_DEFECTO.hapticos === true, 'sin nada guardado, encendida');
  const raro = normalizarAjustes({ tema: '"><script>', acento: 'x;}body{', oled: 'si' });
  check(raro.tema === 'sistema' && raro.acento === 'morado' && raro.oled === false && normalizarAjustes({ tema: 'oscuro', acento: 'pino', oled: true }).tema === 'oscuro', 'un tema, un acento o un negro puro que no son de los que hay vuelven a los de serie');
  const { pautadasHechas, seriesPautadasHechas } = await import('../web/src/logica/visual.js');
  const ej = { series: 3 };
  check(!pautadasHechas(ej, { 1: {}, 2: {}, 4: {} }) && seriesPautadasHechas(ej, { 1: {}, 2: {}, 4: {} }) === 2, 'una serie de más («Añadir serie») no completa el ejercicio');
  check(pautadasHechas(ej, { 1: {}, 2: {}, 3: {} }) && pautadasHechas(ej, { 1: {}, 2: {}, 3: {}, 4: {} }) && !pautadasHechas({ series: 0 }, {}), 'completo con las pautadas (con o sin de más); sin series pautadas, nunca');
  const { contrasteCeldas, CELDA_UNA } = await import('../web/src/logica/acentos.js');
  for (const a of ACENTOS) {
    const r = ['claro', 'oscuro', 'oled'].map((t) => contrasteCeldas(a, t));
    check(r.every((x) => x.ratio >= 3), `calendario con ${a.nombre}: el día con una sesión se distingue del vacío ≥ 3:1 (${r.map((x) => x.ratio).join(' / ')})`);
  }
  const css = (await import('node:fs')).readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');
  const valores = [...css.matchAll(/--celda-una:\s*(\d+)%/g)].map((m) => Number(m[1]));
  check(valores.length === 3 && valores[0] === CELDA_UNA.claro && valores[1] === CELDA_UNA.oscuro && valores[2] === CELDA_UNA.oscuro, `estilos.css usa esas mismas mezclas (${valores.join(', ')} %)`);
  check(PATRONES.serie > 0 && PATRONES.serie <= 20 && PATRONES.record.reduce((t, x) => t + x, 0) < 300 && PATRONES.checkin.length === 3, 'las vibraciones son cortas (un toque al marcar, menos de 300 ms en total al batir un récord)');
}

// ---------- v0.50: piezas visuales ----------
{
  const D = await import('../web/src/logica/diseno.js');
  const { contraste, SUPERFICIES } = await import('../web/src/logica/acentos.js');
  const fs = await import('node:fs');
  console.log('\nv0.50: Hoy según el día');
  const bloque = { id: 'b', numero: 2, nombre: 'Fuerza' };
  const semana = { id: 'w', numero: 3, fecha_inicio: '2026-10-26' }; // lunes
  const ses = (id, o, extra = {}) => ({ id, nombre: id, orden: o, completada: false, ...extra });
  check(D.estadoHoy({ bloque: null, semana: null, sesiones: [], hoy: '2026-10-28' }).tipo === 'sin_semana' && D.estadoHoy({ bloque, semana: null }).tipo === 'sin_semana', 'sin bloque o sin semana publicada: espera a tu coach');
  const hoyToca = D.estadoHoy({ bloque, semana, hoy: '2026-10-28', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-26' }), ses('B', 2, { dia_previsto: '2026-10-28' }), ses('C', 3, { dia_previsto: '2026-10-30' })] });
  check(hoyToca.tipo === 'entreno' && hoyToca.siguiente.id === 'B' && hoyToca.hechas === 1 && hoyToca.total === 3, 'con una sesión prevista para hoy: entreno (la de hoy)');
  const desc = D.estadoHoy({ bloque, semana, hoy: '2026-10-29', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-28' }), ses('B', 2, { dia_previsto: '2026-10-30' })] });
  check(desc.tipo === 'descanso' && desc.proxima.sesion.id === 'B' && desc.proxima.dia === '2026-10-30', 'con plan y nada hoy: descanso, con lo siguiente y su día');
  const hecha = D.estadoHoy({ bloque, semana, hoy: '2026-10-28', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-28' }), ses('B', 2, { dia_previsto: '2026-10-30' }), ses('C', 3)] });
  check(hecha.tipo === 'hecha' && hecha.hechaHoy.id === 'A' && hecha.proxima.sesion.id === 'B', 'hecha hoy y nada más previsto hoy: la celebración y lo siguiente');
  const sinPlan = D.estadoHoy({ bloque, semana, hoy: '2026-10-28', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-28' }), ses('B', 2)] });
  check(sinPlan.tipo === 'hecha' && sinPlan.proxima.sesion.id === 'B' && sinPlan.proxima.dia === null, 'sin plan, lo siguiente es la primera pendiente (cuando quiera)');
  const doble = D.estadoHoy({ bloque, semana, hoy: '2026-10-28', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-28' }), ses('B', 2, { dia_previsto: '2026-10-28' })] });
  check(doble.tipo === 'entreno' && doble.siguiente.id === 'B', 'dos previstas para hoy y una hecha: la segunda sigue tocando');
  const todas = D.estadoHoy({ bloque, semana, hoy: '2026-10-30', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-27' }), ses('B', 2, { completada: true, fecha_realizada: '2026-10-30' })] });
  check(todas.tipo === 'semana' && todas.hechaHoy.id === 'B' && todas.proxima === null, 'todas hechas: semana completa (aunque la última sea de hoy)');
  check(D.estadoHoy({ bloque, semana, hoy: '2026-10-28', sesiones: [] }).tipo === 'descanso', 'una semana publicada sin sesiones: descanso, sin nada después');
  const atr = D.estadoHoy({ bloque, semana, hoy: '2026-10-29', sesiones: [ses('A', 1, { completada: true, fecha_realizada: '2026-10-29' }), ses('B', 2, { dia_previsto: '2026-10-27' }), ses('C', 3, { dia_previsto: '2026-10-31' })] });
  check(atr.tipo === 'hecha' && atr.proxima.sesion.id === 'B' && atr.proxima.atrasada === true && atr.proxima.dia === '2026-10-27', 'hecha hoy con una sesión atrasada: lo siguiente es la atrasada (con su día), no la que viene');
  const futura = D.estadoHoy({ bloque, semana: { ...semana, fecha_inicio: '2026-11-02' }, hoy: '2026-10-28', sesiones: [ses('A', 1, { dia_previsto: '2026-11-03' })] });
  check(futura.tipo === 'entreno' && futura.siguiente.id === 'A', 'una semana que aún no ha empezado no es descanso: enseña la primera');
  const ideas = new Set(Array.from({ length: 8 }, (_, i) => D.sugerenciaDescanso(`2026-11-0${i + 1}`).id));
  check(ideas.size === D.SUGERENCIAS_DESCANSO.length && D.sugerenciaDescanso('2026-11-03').id === D.sugerenciaDescanso('2026-11-03').id && D.sugerenciaDescanso('2025-01-01').titulo, 'una idea para el descanso, distinta cada día y la misma todo el día (también antes de 2026)');

  console.log('\nv0.50: pictogramas por patrón de movimiento');
  const casos = [
    ['Press banca', 'empuje_h'], ['Press inclinado con mancuernas', 'empuje_h'], ['Fondos en paralelas', 'empuje_h'], ['Flexiones', 'empuje_h'], ['Pec-fly/Pec-deck', 'empuje_h'],
    ['Press militar con barra', 'empuje_v'], ['Landmine shoulder press', 'empuje_v'],
    ['Remo con barra', 'tiron_h'], ['Face pull', 'tiron_h'], ['Pájaros desde polea baja', 'tiron_h'], ['Cruce de poleas reverso de pie', 'tiron_h'],
    ['Dominadas pronas', 'tiron_v'], ['Jalón al pecho neutro', 'tiron_v'], ['Pull over unilateral desde polea alta', 'tiron_v'], ['Remo al mentón', 'tiron_v'],
    ['Sentadilla barra baja', 'sentadilla'], ['Prensa de piernas', 'sentadilla'], ['Sentadilla goblet', 'sentadilla'],
    ['Peso muerto rumano con barra RDL', 'bisagra'], ['Hip thrust unilateral con barra', 'bisagra'], ['Buenos días en multipower', 'bisagra'], ['Extensiones en banco inclinado 45º focus glúteo', 'bisagra'],
    ['Sentadilla búlgara con mancuerna', 'unilateral'], ['Zancadas', 'unilateral'], ['High step up', 'unilateral'],
    ['Curl de bíceps con mancuernas', 'brazo'], ['Press francés con barra', 'brazo'], ['Elevaciones laterales en máquina', 'brazo'],
    ['Leg curl tumbado', 'pierna'], ['Curl femoral sentado', 'pierna'], ['Leg extensions', 'pierna'], ['Gemelo en máquina de pie', 'pierna'],
    ['Plancha', 'core'], ['Press pallof', 'core'], ['Crunch en máquina', 'core'], ['Leg raises en banco declinado', 'core'],
    ['Remo ergómetro', 'cardio'], ['Carrera continua', 'cardio'], ['Bici estática', 'cardio'], ['Cinta de correr', 'cardio'], ['Caminar en cinta inclinada', 'cardio'],
    ['Tríceps en polea con cinta', 'brazo'], ['Curl en polea con cinta', 'brazo'], ['Face pull con cinta', 'tiron_h'], ['Jalón con cinta', 'tiron_v'],
  ];
  const mal = casos.filter(([n, p]) => D.patronEjercicio(n) !== p).map(([n, p]) => `${n}: ${D.patronEjercicio(n)} (no ${p})`);
  check(!mal.length, `por el nombre, sin tildes ni mayúsculas: ${casos.length} ejercicios en su patrón${mal.length ? ` (fallan: ${mal.join('; ')})` : ''}`);
  check(D.patronEjercicio('Curl femoral') === 'pierna' && D.patronEjercicio('Remo ergómetro') === 'cardio' && D.patronEjercicio('Press pallof') === 'core', 'lo más concreto antes: «curl femoral» es de pierna, «remo ergómetro» es cardio y «press pallof», core');
  check(D.patronEjercicio('Máquina X', ['cuadriceps'], ['aislamiento']) === 'pierna' && D.patronEjercicio('Máquina X', ['deltoides'], ['aislamiento']) === 'brazo'
    && D.patronEjercicio('Máquina X', ['pectoral']) === 'empuje_h' && D.patronEjercicio('Máquina X', ['espalda', 'biceps']) === 'tiron_h' && D.patronEjercicio('Máquina X', ['gluteo']) === 'bisagra', 'sin pista en el nombre: por el grupo principal y el tipo de la biblioteca');
  check(D.patronEjercicio('Extensión en polea con cinta', ['triceps']) === 'brazo' && D.patronEjercicio('Algo en cinta', ['pectoral']) === 'empuje_h', '«cinta» como accesorio de polea no es cardio (solo «cinta de correr», «en cinta»…)');
  check(D.urlSegura('https://www.notion.so/ana') === 'https://www.notion.so/ana' && D.urlSegura('http://notion.so/x') === null && D.urlSegura('javascript:alert(1)') === null
    && D.urlSegura(' https://a.es/b ') === 'https://a.es/b' && D.urlSegura('') === null && D.urlSegura(null) === null && D.urlSegura('notion.so') === null, 'la página de Notion solo se enlaza si es https');
  check(D.patronEjercicio('Algo nuevo') === 'otro' && D.patronEjercicio('') === 'otro' && D.patronEjercicio(null, null, null) === 'otro', 'sin nombre que diga nada ni grupos: «otro»');
  check(D.PATRONES.length === 12 && D.PATRONES.every(([k]) => D.NOMBRE_PATRON[k]), 'doce patrones, cada uno con su nombre');
  const pictos = fs.readFileSync(new URL('../web/src/ui/Pictograma.jsx', import.meta.url), 'utf8');
  check(D.PATRONES.every(([k]) => new RegExp(`\\n  ${k}: `).test(pictos)) && /aria-hidden="true"/.test(pictos), 'cada patrón tiene su pictograma, decorativo (aria-hidden)');

  console.log('\nv0.50: las tarjetas de Semana (minutos y músculos)');
  const pa = (series, descanso, grupos, nombre = 'X', superserie = null) => ({ series, descanso_seg: descanso, superserie, ejercicio: { nombre, grupos_musculares: grupos } });
  const r1 = D.resumenPautas([pa(3, 120, ['pectoral', 'triceps'], 'Press banca'), pa(3, 90, ['espalda', 'biceps'], 'Remo con barra'), pa(2, null, ['biceps'], 'Curl de bíceps')]);
  // (3 × (40 + 120) + 3 × (40 + 90) + 2 × (40 + 90)) s = 1130 s ≈ 18,8 min → 20
  check(r1.minutos === 20 && r1.series === 8 && r1.ejercicios === 3, `minutos de las series y sus descansos (90 s si no lo pone), redondeados a 5 (${r1.minutos})`);
  check(r1.grupos.join() === 'biceps,espalda,pectoral' && r1.patrones.join() === 'empuje_h,tiron_h,brazo', `los músculos que más trabaja (principal 1, secundarios 0,5) y los patrones en su orden (${r1.grupos.join()})`);
  const ss = D.resumenPautas([pa(3, 60, ['pectoral'], 'Press banca', 'A'), pa(3, 90, ['espalda'], 'Remo', 'A')]);
  check(ss.minutos === 10, `en una superserie, el descanso al acabar cada ronda (3 × 80 s + 3 × 90 s = 8,5 min → ${ss.minutos})`);
  check(D.resumenPautas([]).minutos === 0 && D.resumenPautas(null).grupos.length === 0 && D.resumenPautas([pa(0, 90, ['pectoral'])]).ejercicios === 0, 'sin ejercicios (o con 0 series), nada');
  check(D.resumenPautas([pa(4, 90, ['cuadriceps', 'gluteo']), pa(3, 90, ['isquiotibiales', 'gluteo']), pa(3, 90, ['gemelo']), pa(3, 90, ['abdominales'])], 2).grupos.join() === 'cuadriceps,gluteo', 'como mucho los n que se piden');
  check(D.resumenPautas([pa(3, 90, ['pectoral'], 'Press banca'), pa(3, 90, ['pectoral'], 'Press inclinado'), pa(3, 90, ['espalda'], 'Remo'), pa(2, 90, ['biceps'], 'Curl'), pa(2, 90, ['triceps'], 'Press francés'), pa(2, 90, ['abdominales'], 'Plancha')]).patrones.length === 4, 'los pictogramas, sin repetir y como mucho 4');

  console.log('\nv0.50: la evolución de un récord');
  const hs = [
    { id: '1', ejercicio_id: 'b', fecha: '2026-09-01', sesion_id: 's1', kg: 60, reps: 5, rpe: 8 },
    { id: '2', ejercicio_id: 'b', fecha: '2026-09-08', sesion_id: 's2', kg: 62.5, reps: 5, rpe: 8 },
    { id: '3', ejercicio_id: 'b', fecha: '2026-09-15', sesion_id: 's3', kg: 60, reps: 5, rpe: 8 },
    { id: '4', ejercicio_id: 'b', fecha: '2026-09-22', sesion_id: 's4', kg: 65, reps: 5, rpe: 8 },
    { id: '5', ejercicio_id: 'x', fecha: '2026-09-22', sesion_id: 's4', kg: 100, reps: 5, rpe: 8 },
  ];
  const h = D.historiaRecords(hs, 'b');
  check(h.unidad === 'kg' && h.puntos.map((x) => x.x).join() === '2026-09-01,2026-09-08,2026-09-22' && h.puntos[2].y > h.puntos[1].y && h.puntos[1].y > h.puntos[0].y, 'su mejor 1RM estimado en cada día que subió (el primero, su punto de partida; el día que no subió, nada)');
  check(h.veces.length === 2 && h.veces[0].fecha === '2026-09-22' && h.veces[0].tipo === 'e1rm' && /1RM estimado/.test(h.veces[0].texto), 'cada vez que lo batió, de la más reciente a la más antigua (los mismos récords que la vitrina)');
  const sinCarga = D.historiaRecords([{ ejercicio_id: 'd', fecha: '2026-09-01', sesion_id: 'a', kg: 0, reps: 8 }, { ejercicio_id: 'd', fecha: '2026-09-05', sesion_id: 'b', kg: 0, reps: 10 }], 'd');
  check(sinCarga.unidad === 'rep' && sinCarga.puntos.map((x) => x.y).join() === '8,10' && sinCarga.veces.length === 1, 'sin carga, las repeticiones');
  check(D.historiaRecords([], 'b').puntos.length === 0 && D.historiaRecords(hs, 'nada').veces.length === 0, 'sin series de ese ejercicio, vacía');
  check(D.esReciente('2026-10-10', '2026-11-01') && !D.esReciente('2026-09-20', '2026-11-01') && !D.esReciente(null) && !D.esReciente('2026-11-05', '2026-11-01'), '«Nuevo»: batido hace menos de 30 días');

  console.log('\nv0.50: la bandeja por atletas');
  const ana = { id: 'a', nombre: 'Ana López' }, ruben = { id: 'r', nombre: 'Rubén Martín' }, carlos = { id: 'c', nombre: 'Carlos Vera' };
  const g = D.agruparPorAtleta([
    { tipo: 'sesiones', clave: '1', atleta: ruben }, { tipo: 'mensajes', clave: '2', atleta: ana }, { tipo: 'videos', clave: '3', atleta: ruben },
    { tipo: 'comunidad', clave: '4', atleta: null }, { tipo: 'checkins', clave: '5', atleta: carlos }, { tipo: 'sesiones', clave: '6', atleta: ruben }, { tipo: 'tareas', clave: '7', atleta: ana },
  ]);
  check(g.map((x) => x.id).join() === 'r,a,c,equipo' && g[0].n === 3 && g[0].items.map((x) => x.clave).join() === '1,3,6', 'cada atleta con lo suyo (en su orden), primero quien más tiene; a igualdad, por nombre; lo del equipo, al final');
  check(D.textoTipos(g[0].tipos) === '2 sesiones, 1 vídeo' && D.textoTipos({ checkins: 1 }) === '1 check-in' && D.textoTipos({}) === '', `y de qué («${D.textoTipos(g[0].tipos)}»)`);
  check(D.agruparPorAtleta([]).length === 0 && D.agruparPorAtleta(null).length === 0, 'bandeja vacía, sin grupos');
  check(D.esDeslizar(130, 10, 360) && !D.esDeslizar(80, 5, 360) && !D.esDeslizar(130, 120, 360) && !D.esDeslizar(-130, 0, 360) && D.esDeslizar(80, 5, 200), 'deslizar cuenta con más de un 35 % del ancho (o 96 px), claramente en horizontal y a la derecha');
  check(D.duracionCorta(8) === '0:08' && D.duracionCorta(65) === '1:05' && D.duracionCorta(null) === '0:00', 'la duración de un vídeo: «0:08», «1:05»');

  console.log('\nv0.50: un día de nutrición');
  const obj = { kcal: 2000, proteina: 140, carbos: 220, grasa: 60 };
  const m0 = D.macrosDia(null, obj);
  check(m0.kcal.estado === 'sin_dato' && m0.kcal.quedan === 2000 && m0.macros.length === 3 && m0.macros.every((x) => x.valor === null && x.frac === 0), 'sin apuntar: todo por comer, los tres anillos vacíos');
  const m1 = D.macrosDia({ kcal: 1500, proteina_g: 130, carbos_g: '150', grasa_g: 40 }, obj);
  check(m1.kcal.quedan === 500 && m1.kcal.estado === 'falta' && m1.macros[0].estado === 'cumple' && m1.macros[1].valor === 150 && Math.abs(m1.macros[2].frac - 2 / 3) < 1e-9, 'lo comido, lo que queda y cada macro frente a su objetivo');
  const m2 = D.macrosDia({ kcal: 2400 }, obj);
  check(m2.kcal.quedan === -400 && m2.kcal.estado === 'pasado' && D.macrosDia({ kcal: 1950 }, obj).kcal.estado === 'cumple', 'pasarse se dice (y a ±10 %, en objetivo)');
  check(D.macrosDia({ kcal: 5000 }, obj).kcal.frac === 1.5 && D.macrosDia(null, { kcal: 1800, proteina: 120, carbos: null, grasa: null }).macros.map((x) => x.id).join() === 'proteina', 'el anillo no pasa de 1,5 vueltas; con solo kcal y proteína, un anillo');
  check(D.macrosDia({ kcal: 100 }, null) === null && D.macrosDia({ kcal: 100 }, { kcal: 0 }) === null, 'sin objetivo de kcal, nada');
  for (const [tema, sup] of [['claro', SUPERFICIES.claro], ['oscuro', SUPERFICIES.oscuro], ['oled', SUPERFICIES.oled]]) {
    const cols = D.COLORES_MACRO[tema === 'claro' ? 'claro' : 'oscuro'];
    const peor = Math.min(...Object.values(cols).flatMap((c) => Object.values(sup).map((f) => contraste(c, f))));
    check(peor >= 3, `los macros en ${tema}: cada color, al menos 3:1 sobre todas sus superficies (el peor, ${peor.toFixed(2)}:1); entre sí, distinto tono y con su nombre`);
  }
  const cssM = fs.readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');
  const decl = [...cssM.matchAll(/--macro-proteina: (#[0-9A-F]{6}); --macro-carbos: (#[0-9A-F]{6}); --macro-grasa: (#[0-9A-F]{6})/g)].map((x) => x.slice(1).join());
  check(decl.length === 3 && decl[0] === Object.values(D.COLORES_MACRO.claro).join() && decl[1] === Object.values(D.COLORES_MACRO.oscuro).join() && decl[2] === decl[1], 'estilos.css usa esos mismos colores (claro y los dos oscuros)');

  console.log('\nv0.50: perfil, tamaño de la letra y lo que se queda en el móvil');
  check(D.semanasCompletas([{ fecha_inicio: '2026-10-05', total: 3, hechas: 3 }, { fecha_inicio: '2026-10-12', total: 3, hechas: 2 }, { fecha_inicio: '2026-10-19', total: 2, hechas: 2 }, { fecha_inicio: '2026-10-19', total: 1, hechas: 1 }, { fecha_inicio: '2026-10-26', total: 3, hechas: 3 }, { fecha_inicio: '2026-11-02', total: 0, hechas: 0 }], '2026-10-28') === 3,
    'semanas completas en total (no la racha): las del mismo lunes se suman y la de esta semana cuenta si ya está completa');
  check(D.semanasCompletas([], '2026-10-28') === 0 && D.semanasCompletas([{ fecha_inicio: '2026-11-02', total: 2, hechas: 2 }], '2026-10-28') === 0, 'sin semanas, o solo futuras, ninguna');
  const { normalizarAjustes, AJUSTES_DEFECTO, TAMANOS_LETRA } = await import('../web/src/ui/ajustes.js');
  check(AJUSTES_DEFECTO.letra === 'normal' && TAMANOS_LETRA.map(([k, , pct]) => `${k}:${pct}`).join() === 'normal:100,grande:112.5,muy-grande:125', 'tres tamaños de letra (100 %, 112,5 % y 125 %), el normal de serie');
  check(normalizarAjustes({ letra: 'grande' }).letra === 'grande' && normalizarAjustes({ letra: 'enorme' }).letra === 'normal' && normalizarAjustes({ letra: '"><b>' }).letra === 'normal' && normalizarAjustes({ letra: 3 }).letra === 'normal' && normalizarAjustes({}).letra === 'normal', 'un tamaño que no es de los tres vuelve al normal');
  const reglasPx = [...cssM.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([x, sel, b]) => [x, sel, b.replace(/font-size: min\([\d.]+rem, [\d.]+px\)/g, '')]).filter(([, , b]) => /font(-size)?:[^;]*\d px|font-size:[^;]*\d+(\.\d+)?px|font:\s*\d+\s+\d+(\.\d+)?px/.test(b)).map(([, sel]) => sel.trim());
  check(reglasPx.length > 0 && reglasPx.every((sel) => /text|anillo-num|valor-barra/.test(sel)), `el texto va en rem: solo los textos de dentro de las gráficas (SVG) siguen en px (${reglasPx.length} reglas; la barra de abajo, en rem con un tope)`);
  check(/:root\[data-letra="grande"\] \{ font-size: 112\.5%; \}/.test(cssM) && /:root\[data-letra="muy-grande"\] \{ font-size: 125%; \}/.test(cssM), 'el tamaño elegido cambia la raíz');
  const legal = await import('../web/src/legal.js');
  const fila = legal.PRIVACIDAD ? legal.PRIVACIDAD.find(([t]) => t === 'Lo que se queda en tu móvil') : null;
  const textoLegal = fs.readFileSync(new URL('../web/src/legal.js', import.meta.url), 'utf8');
  check(/el tamaño de la letra/.test(fila ? fila[1] : textoLegal) && /^\d{4}-\d{2}(\.[1-9])?$/.test(legal.VERSION_LEGAL), '«Lo que se queda en tu móvil» dice también el tamaño de la letra (sin cambiar la versión de la política)');
  const ilus = fs.readFileSync(new URL('../web/src/ui/Ilustraciones.jsx', import.meta.url), 'utf8');
  check(['mensajes', 'diario', 'records', 'checkins', 'tareas', 'todo', 'filtro', 'descanso', 'hecha', 'semana', 'espera'].every((k) => new RegExp(`\\n  ${k}: \\(\\) =>`).test(ilus)) && !/#[0-9a-fA-F]{3,6}/.test(ilus), 'las ilustraciones: una por estado vacío y por día de Hoy, sin colores escritos (los pone el tema)');
}
// ---------- v0.51: piezas visuales ----------
{
  const T = await import('../web/src/logica/tablero.js');
  const A = await import('../web/src/logica/arte.js');
  const AC = await import('../web/src/logica/acentos.js');
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');

  console.log('\nv0.51: tipografía y vidrio');
  const tokens = ['--tipo-display', '--tipo-titulo', '--tipo-titular', '--tipo-cuerpo', '--tipo-pie', '--cifra-xl', '--cifra-l', '--cifra-m', '--cifra-s', '--ancho-expandido', '--ancho-marcador'];
  check(tokens.every((t) => new RegExp(`${t}:`).test(css)) && /--ancho-expandido: 12\d%/.test(css) && /--ancho-marcador: [78]\d%/.test(css), 'la escala tipográfica está en tokens: display, título, titular, cuerpo, pie y cifras, con el ancho expandido (títulos) y el condensado (cifras)');
  check(/\.cabecera-grande \.titulo h1 \{ font-size: var\(--tipo-titulo\)/.test(css) && /\.titular h2 \{ font-size: var\(--tipo-display\)/.test(css) && /\.resumen-num \.v \{ font-size: var\(--cifra-l\); font-stretch: var\(--ancho-marcador\)/.test(css),
    'los títulos de pantalla y la tarjeta del día usan la escala (expandidos) y las cifras grandes, el marcador (condensadas)');
  let malas = [];
  for (const a of AC.ACENTOS) for (const t of ['claro', 'oscuro', 'oled']) for (const tipo of ['barra', 'cabecera', 'hoja']) malas.push(...AC.parejasVidrio(a, t, tipo).filter((x) => x.ratio < 4.5).map((x) => `${a.id}/${t}/${x.que}: ${x.ratio}`));
  check(malas.length === 0, `sobre el vidrio, el texto pasa AA en el peor caso (negro detrás en claro, blanco en oscuro) con los seis acentos ${malas.slice(0, 3).join('; ')}`);
  check(AC.parejasVidrio(AC.ACENTOS[0], 'claro', 'hoja').some((x) => x.que.startsWith('tinta-3')) && !AC.parejasVidrio(AC.ACENTOS[0], 'claro', 'barra').some((x) => x.que.startsWith('tinta-3')), 'en las hojas también tinta-3 (por eso tapan más); en las barras, no');
  const mezclas = (v, base) => [...css.matchAll(new RegExp(`${v}: color-mix\\(in srgb, var\\(--${base}\\) (\\d+)%`, 'g'))].map((m) => Number(m[1]));
  const V = AC.VIDRIO;
  check(mezclas('--vidrio', 'hoja').join() === [V.barra.claro, V.barra.oscuro, V.barra.oscuro, V.barra.oled, V.barra.oled].join()
    && mezclas('--vidrio-cab', 'tiza').join() === [V.cabecera.claro, V.cabecera.oscuro, V.cabecera.oscuro, V.cabecera.oled, V.cabecera.oled].join()
    && mezclas('--vidrio-hoja', 'hoja').join() === [V.hoja.claro, V.hoja.oscuro, V.hoja.oscuro, V.hoja.oled, V.hoja.oled].join(), 'estilos.css usa esas mismas transparencias (claro, los dos oscuros y los dos negro puro)');
  check(/@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\)/.test(css) && /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/.test(css), 'con «reducir transparencia», «más contraste» o sin backdrop-filter, superficies opacas');

  console.log('\nv0.51: los diales de Hoy');
  const ses = (n, hechas) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, orden: i + 1, completada: i < hechas }));
  const c1 = T.dialConstancia(ses(3, 2));
  check(c1.hechas === 2 && c1.total === 3 && Math.abs(c1.valor - 2 / 3) < 1e-9 && c1.etiqueta === 'Te queda 1' && c1.estado === 'en_curso', 'constancia: 2 de 3 sesiones, «Te queda 1»');
  check(T.dialConstancia(ses(3, 3)).estado === 'completa' && T.dialConstancia([]).estado === 'sin' && T.dialConstancia([]).valor === 0, 'completa con todas; sin sesiones, vacía');
  // Carga: semanas de lunes; «hoy» es miércoles 2026-11-04. Tres semanas anteriores con 300 de lunes a miércoles y 600 en total
  const s = (f, rpe, min) => ({ completada: true, fecha_realizada: f, rpe_sesion: rpe, duracion_min: min });
  const previas = ['2026-10-12', '2026-10-19', '2026-10-26'].flatMap((l) => [s(l, 6, 50), s(sumarDias(l, 4), 6, 50)]);
  const k1 = T.dialCarga([...previas, s('2026-11-02', 6, 50)], '2026-11-04');
  check(k1.esperado === 300 && k1.actual === 300 && k1.ratio === 1 && k1.estado === 'media' && k1.etiqueta === 'En tu media' && k1.valor === 0.5, 'carga: igual que lo que suele llevar a estas alturas de la semana, «En tu media» (la aguja en el centro)');
  check(T.dialCarga([...previas, s('2026-11-02', 6, 50), s('2026-11-03', 8, 70)], '2026-11-04').estado === 'encima' && T.dialCarga([...previas], '2026-11-04').estado === 'debajo', 'por encima con una sesión de más; sin nada aún, por debajo');
  const lunes = T.dialCarga([...previas], '2026-11-02');
  check(lunes.esperado === 300 && lunes.estado === 'debajo', 'un lunes se compara con lo de los lunes (no con la semana entera)');
  const sinLunes = T.dialCarga(['2026-10-19', '2026-10-26'].map((l) => s(sumarDias(l, 3), 6, 50)), '2026-11-02');
  check(sinLunes.esperado === 0 && sinLunes.ratio === 1 && sinLunes.estado === 'media', 'si otras semanas a estas alturas no llevaba nada y hoy tampoco, va como siempre');
  check(T.dialCarga([s('2026-10-26', 6, 50)], '2026-11-04').estado === 'sin_media' && T.dialCarga([{ ...s('2026-10-19', null, 50) }, s('2026-10-26', 6, 50)], '2026-11-04').estado === 'sin_media', 'con menos de dos semanas con carga (o sesiones sin esfuerzo), sin media');
  check(T.BANDA_CARGA.join() === '0.8,1.3', 'la banda «En tu media», de 0,8 a 1,3 veces lo habitual');
  const prep = { sueno: 1, energia: 2, molestias: 3 };
  const sesP = [{ id: 'a', completada: true, fecha_realizada: '2026-11-03', preparacion: { sueno: 3, energia: 3, molestias: 3 } }, { id: 'b', completada: false, preparacion: prep }, { id: 'c', completada: true, fecha_realizada: '2026-11-04', preparacion: { sueno: 3, energia: 3, molestias: 3 } }];
  check(T.preparacionDeHoy(sesP, '2026-11-04').sueno === 3 && T.preparacionDeHoy(sesP, '2026-11-04', { marcadas: ['b'] }) === prep && T.preparacionDeHoy(sesP, '2026-11-04', { seriesHoy: ['b'] }) === prep && T.preparacionDeHoy(sesP, '2026-11-05') === null, 'cómo llegas: solo lo contestado hoy (una sesión hecha hoy, una con series de hoy o la contestada hoy en este móvil); lo de ayer, no');
  check(!T.prepDeHoy(sesP[1], '2026-11-04') && T.prepDeHoy(sesP[1], '2026-11-04', { marcadas: ['b'] }) && !T.prepDeHoy(sesP[0], '2026-11-04') && T.prepDeHoy(sesP[2], '2026-11-04') && !T.prepDeHoy({ id: 'z', completada: false, preparacion: null }, '2026-11-04', { marcadas: ['z'] }),
    'la misma regla para el dial y la sesión: lo guardado sin hora de otro día no cuenta como de hoy (la sesión vuelve a preguntar)');
  const hoyS = { id: 'h', completada: false }, sig = { id: 'g', completada: false };
  check(T.sesionParaContestar({ previstaHoy: hoyS, siguiente: sig }) === hoyS && T.sesionParaContestar({ siguiente: sig }) === null && T.sesionParaContestar({ siguiente: sig, seriesHoy: ['g'] }) === sig
    && T.sesionParaContestar({ previstaHoy: hoyS, baja: true }) === null && T.sesionParaContestar({ previstaHoy: { id: 'x', completada: true } }) === null,
    'desde Hoy solo se contesta para la sesión prevista para hoy (o una con series de hoy); nunca de baja');
  const ahoraIso = new Date().toISOString();
  check(T.conSeriesDeHoy([{ registrada_en: ahoraIso }]) && !T.conSeriesDeHoy([{ registrada_en: new Date(Date.now() - 50 * 3600e3).toISOString() }]) && !T.conSeriesDeHoy([]), 'series de hoy, en hora de Madrid');
  const l1 = T.dialComoLlegas(prep);
  check(l1.estado === 'flojo' && l1.etiqueta === 'Día flojo' && l1.total === 6 && l1.respuestas.map((r) => r.texto).join() === 'Mal,Normal,Ninguna', 'con lo contestado: «Día flojo», 6 de 9, y cada respuesta');
  check(T.dialComoLlegas(null).estado === 'sin_respuesta' && T.dialComoLlegas({ sueno: 1 }).estado === 'sin_respuesta', 'sin contestar (o a medias), lo pide');
  const ar = T.arcoDial(0.5, 64, 7);
  check(Math.abs(ar.largo - (2 * Math.PI * 28.5 * 0.75)) < 1e-6 && Math.abs(ar.lleno - ar.largo / 2) < 1e-6 && ar.punto.x === 32 && ar.punto.y === 3.5, 'el dial: 270° abierto por abajo; a la mitad, arriba del todo');

  console.log('\nv0.51: los anillos de la semana');
  const hab = (c, p) => ({ semana: { cumplidos: c, pedidos: p } });
  const an = T.anillosSemana({ sesiones: ses(3, 3), habitos: [hab(5, 7), hab(9, 7)], checkin: { id: 'x' } });
  check(an.map((a) => a.id).join() === 'sesiones,habitos,checkin' && an[0].cerrado && !an[1].cerrado && an[1].valor === 12 && an[1].objetivo === 14 && an[2].cerrado, 'sesiones (cerrado), hábitos (12 de 14 días: lo de más de un hábito no tapa lo que falta de otro) y check-in (cerrado)');
  check(T.anillosSemana({ sesiones: ses(2, 1), habitos: [], conCheckin: false }).map((a) => a.id).join() === 'sesiones' && T.anillosSemana({ sesiones: [] })[0].cerrado === false, 'sin hábitos ni check-in, solo el de las sesiones; sin sesiones, nunca cerrado');
  const c0 = T.anillosPorCelebrar(an, null, '2026-11-02');
  check(c0.celebrar.join() === 'sesiones,checkin' && c0.guardar.lunes === '2026-11-02', 'celebra los que se han cerrado');
  check(T.anillosPorCelebrar(an, c0.guardar, '2026-11-02').celebrar.length === 0 && T.anillosPorCelebrar(an, c0.guardar, '2026-11-09').celebrar.join() === 'sesiones,checkin', 'una vez por anillo y semana (la semana que viene, otra vez)');
  check(T.anillosPorCelebrar(an, { lunes: '2026-11-02', cerrados: 'x' }, '2026-11-02').celebrar.length === 2 && T.anillosPorCelebrar(an, { lunes: '2026-11-02', cerrados: [{}] }, '2026-11-02').celebrar.length === 2, 'lo guardado raro no rompe nada');

  console.log('\nv0.51: medallas, tramos, equipo y comunidad');
  check(T.METALES.map((m) => `${m.nombre}:${m.canto}`).join() === 'Bronce:liso,Plata:perlado,Oro:estriado,Platino:doble' && T.metalDe(3).id === 'oro' && T.metalDe(0) === null, 'los cuatro niveles son bronce, plata, oro y platino, cada uno con su canto (se distinguen sin el color)');
  const ejs = [{ id: 'e1', series: 3 }, { id: 'e2', series: 2, superserie: 'A' }, { id: 'e3', series: 2, superserie: 'A' }, { id: 'e4', series: 3 }];
  const tr = T.tramosSesion(ejs, { e1: { 1: {}, 2: {}, 3: {}, 4: {} }, e2: { 1: {} }, e3: { 1: {} } }, 'e3');
  check(tr.length === 3 && tr[0].completo && tr[0].hechas === 3 && tr[1].letra === 'A' && tr[1].series === 4 && tr[1].hechas === 2 && tr[1].actual && !tr[2].actual && tr[2].frac === 0, 'un tramo por ejercicio y uno por superserie; las series de más no cuentan; el de la serie que toca, resaltado');
  const res = [
    { atleta_id: 'a', estado: 'activo', servicio: 'completo', ultimaSerie: '2026-11-04', alertas: [] },
    { atleta_id: 'b', estado: 'activo', servicio: 'entrenamiento', ultimaSerie: '2026-10-20', ultimaSesion: '2026-11-04', alertas: [] },
    { atleta_id: 'c', estado: 'activo', servicio: 'completo', ultimaSerie: '2026-10-28', alertas: [] },
    { atleta_id: 'd', estado: 'activo', servicio: 'completo', ultimaSerie: null, alertas: [{ tipo: 'sin_entrenar' }] },
    { atleta_id: 'e', estado: 'activo', servicio: 'completo', ultimaSerie: null, alertas: [] },
    { atleta_id: 'f', estado: 'activo', servicio: 'nutricion', ultimaSerie: null, alertas: [] },
    { atleta_id: 'g', estado: 'baja', servicio: 'completo', ultimaSerie: '2026-09-01', alertas: [] },
  ];
  const eq = T.equipoHoy(res, '2026-11-04');
  check(eq.activos === 5 && eq.entrenaron === 2 && eq.inactivos.join() === 'c,d', `hoy en tu equipo: 2 de 5 activos entrenaron (una serie o una sesión de cardio), y 2 sin actividad ≥ 7 días (los de solo nutrición y de baja no cuentan) ${JSON.stringify(eq)}`);
  const { resumenAtleta } = await import('../web/src/logica/calculos.js');
  const ra = resumenAtleta({ atleta: { id: 'x', nombre: 'X', estado: 'activo' }, sesionesRecientes: [{ completada: true, fecha_realizada: '2026-11-01' }, { completada: true, fecha_realizada: '2026-11-03' }, { completada: true, fecha_realizada: '2026-11-09' }] }, '2026-11-04');
  check(ra.ultimaSesion === '2026-11-03', 'el resumen del panel trae la última sesión terminada (nunca una con fecha futura)');
  const ahora = Date.now();
  const posts = [{ tipo: 'entreno', autor_id: 'p1', creado_en: new Date(ahora).toISOString() }, { tipo: 'post', autor_id: 'p2', creado_en: new Date(ahora).toISOString() }, { tipo: 'entreno', autor_id: 'p3', creado_en: new Date(ahora - 50 * 3600e3).toISOString() }, { tipo: 'entreno', autor_id: 'p4', oculta: true, creado_en: new Date(ahora).toISOString() }];
  const { fechaMadrid } = await import('../web/src/logica/fechas.js');
  const quien = T.compartieronHoy(posts, fechaMadrid());
  check(quien.has('p1') && !quien.has('p2') && !quien.has('p3') && !quien.has('p4') && quien.size === 1, 'el aro: solo quien ha compartido un entreno hoy (hora de Madrid) que se ve en el muro');

  console.log('\nv0.51: la portada de la sesión y las tarjetas para compartir');
  const p1 = A.arteSesion({ nombre: 'Torso A', tipo: 'fuerza', patron: 'empuje_h' });
  const p2 = A.arteSesion({ nombre: 'Torso A', tipo: 'fuerza', patron: 'empuje_h' });
  const p3 = A.arteSesion({ nombre: 'Pierna B', tipo: 'fuerza', patron: 'sentadilla' });
  check(JSON.stringify(p1) === JSON.stringify(p2) && JSON.stringify(p1) !== JSON.stringify(p3) && p1.motivo === 'discos' && p1.familia === 'empuje' && p3.familia === 'pierna', 'el dibujo sale del nombre: la misma sesión, el mismo dibujo; otra, otro');
  check(A.arteSesion({ nombre: 'Rodaje', tipo: 'cardio' }).motivo === 'ondas' && A.arteSesion({ nombre: 'Movilidad', tipo: 'movilidad' }).motivo === 'orbitas', 'cardio con ondas y movilidad con órbitas');
  const dentro = [p1, p3].every((a) => a.formas.every((f) => Object.entries(f).every(([k, v]) => typeof v !== 'number' || Number.isFinite(v)) && (f.t !== 'circulo' || (f.r > 0 && f.r < 400))));
  check(dentro && p1.formas.length > 10 && p1.formas.every((f) => ['acento', 'claro', 'tenue'].includes(f.tono)), 'solo geometría finita y tonos del tema (sin colores escritos)');
  check(A.semilla('Torso A') === A.semilla('Torso A') && A.semilla('Torso A') !== A.semilla('Torso B') && (() => { const r = A.aleatorio(1); const xs = Array.from({ length: 100 }, r); return xs.every((x) => x >= 0 && x < 1); })(), 'semilla y números aleatorios repetibles, entre 0 y 1');
  const d = { nombre: 'Torso A', series: 18, tonelaje: 6420, minutos: 52, records: [{ nombre: 'Press' }], mejores: [] };
  check(A.cifrasTarjeta(d).map((c) => `${c.k}:${c.v}`).join() === 'minutos:52,series:18,tonelaje:6,4,records:1', '«Cifras»: duración, series, tonelaje y récords');
  check(A.cifraHeroe(d).k === 'records' && A.cifraHeroe({ ...d, records: [] }).k === 'tonelaje' && A.cifraHeroe({ series: 3, tonelaje: 0, records: [] }).k === 'series', '«Mínima»: los récords si hay; si no, el tonelaje (o lo que haya)');
  check(!JSON.stringify(A.cifrasTarjeta({ ...d, peso: 80, kcal: 2000, rpe: 9 })).match(/80|2000|peso|kcal|rpe/), 'ninguna lleva peso corporal, nutrición ni esfuerzo');
  const f1 = A.encajarFoto(3000, 4000, 1080, 1350), f2 = A.encajarFoto(4000, 3000, 1080, 1350);
  check(f1.sw === 3000 && f1.sh === 3750 && f1.sy === 88 && f2.sh === 3000 && f2.sw === 2400 && f2.sx === 800 && A.encajarFoto(0, 10) === null, 'la foto se encaja sin deformarse (las verticales, algo por encima del centro)');
  check(A.PLANTILLAS_TARJETA.map(([k]) => k).join() === 'cifras,minima,foto', 'tres plantillas: Cifras, Mínima y Con tu foto');
  const legal = await import('../web/src/legal.js');
  const fila = legal.PRIVACIDAD.find(([t]) => t === 'Lo que se queda en tu móvil');
  check(/foto que eliges para una tarjeta/.test(fila[1]) && /^\d{4}-\d{2}(\.[1-9])?$/.test(legal.VERSION_LEGAL), '«Lo que se queda en tu móvil» dice que la foto de la tarjeta no se sube (sin cambiar la versión de la política)');
}
// ---------- v0.52: movimiento, racha, destacados, gráficas, carné, confeti y respiración ----------
{
  const M = await import('../web/src/logica/muelle.js');
  const AV = await import('../web/src/logica/actividad.js');
  const R = await import('../web/src/logica/racha.js');
  const D = await import('../web/src/logica/destacados.js');
  const G = await import('../web/src/logica/rangos.js');
  const CF = await import('../web/src/logica/confeti.js');
  const RS = await import('../web/src/logica/respira.js');
  const CA = await import('../web/src/logica/carnet.js');
  const V = await import('../web/src/logica/vistas.js');
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');
  const cerca = (a, b, e = 0.5) => Math.abs(a - b) <= e;

  console.log('\nv0.52: el muelle de las hojas');
  const crit = M.muelle({ desde: 300, hasta: 0, velocidad: 0, rigidez: 400, amortiguacion: 1 });
  const subA = M.muelle({ desde: 300, hasta: 0, velocidad: 0, rigidez: 400, amortiguacion: 0.7 });
  const muestrasCrit = Array.from({ length: 120 }, (_, i) => crit.posicion(i / 60));
  const muestrasSub = Array.from({ length: 120 }, (_, i) => subA.posicion(i / 60));
  check(crit.posicion(0) === 300 && muestrasCrit.every((x) => x >= -1e-6) && muestrasCrit.every((x, i) => !i || x <= muestrasCrit[i - 1] + 1e-9) && cerca(crit.posicion(1.5), 0, 0.01),
    'crítico (ζ = 1): baja sin pasarse nunca del tope y llega');
  check(Math.min(...muestrasSub) < -1 && cerca(subA.posicion(2), 0, 0.05), 'subamortiguado (ζ < 1): se pasa un poco y vuelve');
  const sobre = M.muelle({ desde: 300, hasta: 0, velocidad: 0, rigidez: 400, amortiguacion: 1.6 });
  check(cerca(sobre.posicion(0), 300, 1e-6) && Array.from({ length: 200 }, (_, i) => sobre.posicion(i / 60)).every((x) => x >= -1e-6) && sobre.posicion(3) < 2, 'sobreamortiguado: llega despacio y sin pasarse');
  const conV = M.muelle({ desde: 0, hasta: 0, velocidad: 1200, ...M.MUELLE });
  check(conV.posicion(0.05) > 20 && cerca(conV.velocidad(0), 1200, 1e-6) && cerca(conV.posicion(1.5), 0, 0.5), 'con velocidad al soltar, sigue el impulso antes de volver (la velocidad inicial es la del dedo)');
  const der = (f, t) => (f.posicion(t + 1e-4) - f.posicion(t - 1e-4)) / 2e-4;
  check([0.03, 0.1, 0.3].every((t) => cerca(der(subA, t), subA.velocidad(t), 0.5) && cerca(der(crit, t), crit.velocidad(t), 0.5)), 'la velocidad es la derivada de la posición (sub y crítico)');
  const fot = M.fotogramasMuelle({ desde: 500, hasta: 0, velocidad: 0, ...M.MUELLE });
  check(fot.puntos[0] === 500 && fot.puntos[fot.puntos.length - 1] === 0 && fot.duracion > 200 && fot.duracion <= 1500 && Math.min(...fot.puntos) > -12, `fotogramas cada 1/60 s hasta asentarse (${fot.duracion} ms, se pasa como mucho ${Math.round(-Math.min(...fot.puntos))} px de 500)`);
  check(M.MUELLE.amortiguacion < 1 && M.MUELLE.amortiguacion >= 0.8 && M.MUELLE_SUAVE.amortiguacion === 1, 'las constantes: al soltar, un poco subamortiguado (ζ 0,86); al abrir, crítico');
  check(cerca(M.proyectar(100, 1000), 100 + 199, 1) && M.proyectar(100, 0) === 100 && M.proyectar(100, -1000) < 100, 'proyecta adónde iría con la deceleración de iOS (1000 px/s → ~199 px más)');
  check(cerca(M.velocidadDe([{ y: 0, t: 0 }, { y: 10, t: 16 }, { y: 20, t: 32 }, { y: 30, t: 48 }]), 625, 1) && M.velocidadDe([]) === 0 && M.velocidadDe([{ y: 5, t: 10 }]) === 0
    && cerca(M.velocidadDe([{ y: 0, t: 0 }, { y: 400, t: 300 }, { y: 410, t: 380 }, { y: 420, t: 400 }]), 200, 1), 'la velocidad al soltar: la pendiente de los últimos 100 ms (no la de todo el gesto)');
  check(M.goma(0, 500) === 0 && M.goma(100, 500) < 100 && M.goma(100, 500) > 0 && M.goma(1e6, 500) < 500 && M.goma(200, 500) > M.goma(100, 500), 'la goma: por encima del tope se mueve menos que el dedo, cada vez menos, y nunca más que su tamaño');
  check(M.arrastreVisible(120, 600) === 120 && M.arrastreVisible(-80, 600) > -80 && M.arrastreVisible(-80, 600) < 0, 'al arrastrar, 1:1 hacia abajo y con goma hacia arriba');
  const topes = M.topesHoja({ alto: 700, pantalla: 844, medio: true });
  check(topes.completa === 0 && topes.media === Math.round(700 - 844 * 0.55) && topes.cerrada === 724 && M.topesHoja({ alto: 400, pantalla: 844, medio: true }).media === undefined && M.topesHoja({ alto: 700, pantalla: 844 }).media === undefined,
    'topes: completa, media (55 % de la pantalla, solo en las hojas largas que la piden) y cerrada');
  const dh = (y, v, medio = true) => M.destinoHoja({ y, velocidad: v, alto: 700, pantalla: 844, medio }).tope;
  check(dh(30, 0) === 'completa' && dh(200, 0) === 'media' && dh(600, 0) === 'cerrada' && dh(80, 1200) === 'media' && dh(260, 2600) === 'cerrada' && dh(250, -1500) === 'completa',
    'al soltar, el tope más cercano a donde iría: un tirón hacia abajo baja a media (o cierra si es fuerte) y hacia arriba sube a completa');
  check(dh(60, 0, false) === 'completa' && dh(300, 0, false) === 'cerrada' && dh(40, 900, false) === 'cerrada', 'sin tope medio: como antes, se cierra al pasar la mitad o con un gesto rápido hacia abajo');

  console.log('\nv0.52: «Sesión en curso»');
  const ahora = Date.parse('2026-11-04T10:00:00Z');
  const ec = { id: 's1', nombre: 'Torso B', ejercicio: 'Press banca', siguiente: 'Serie 3 de 4: 60 kg × 6', hechas: 5, total: 18, t: ahora - 60000, descanso: { fin: ahora + 80000, total: 120, texto: 'serie 3 de Press banca' } };
  const est = AV.estadoActividad(ec, ahora);
  check(est.nombre === 'Torso B' && est.ejercicio === 'Press banca' && est.descanso.cuenta === '1:20' && cerca(est.descanso.frac, 80 / 120, 0.01) && !est.descanso.terminado, 'con series hechas: el nombre, el ejercicio y el descanso que queda (1:20 de 2:00)');
  check(AV.estadoActividad({ ...ec, hechas: 0 }, ahora) === null && AV.estadoActividad({ ...ec, t: ahora - AV.VIGENCIA_EN_CURSO - 1 }, ahora) === null && AV.estadoActividad(null, ahora) === null && AV.estadoActividad({ nombre: 'x', t: ahora, hechas: 1 }, ahora) === null,
    'sin series, de hace más de 4 horas o mal guardada: no hay píldora');
  const fin = AV.estadoActividad({ ...ec, descanso: { ...ec.descanso, fin: ahora - 2000 } }, ahora);
  check(fin.descanso.terminado && fin.descanso.cuenta === '¡Vamos!' && AV.estadoActividad({ ...ec, descanso: { ...ec.descanso, fin: ahora - 7000 } }, ahora).descanso === null, 'al acabar el descanso, «¡Vamos!» unos segundos y luego sin descanso');
  check(AV.anuncioActividad({ descanso: null }, est) === 'Descanso en curso: 1:20.' && AV.anuncioActividad(est, AV.estadoActividad(ec, ahora + 1000)) === null && AV.anuncioActividad(est, fin) === 'Descanso terminado. Ahora: serie 3 de Press banca.',
    'se anuncia al empezar y al acabar el descanso, nunca cada segundo');
  check(AV.etiquetaActividad(est) === AV.etiquetaActividad(AV.estadoActividad(ec, ahora + 5000)) && !/\d:\d\d/.test(AV.etiquetaActividad(est)), 'el nombre de la píldora no cambia con cada segundo (sin la cuenta)');
  check(!/peso|kcal|salud|rpe/i.test(JSON.stringify(Object.keys(est))), 'la píldora no lleva peso, salud ni nutrición');

  console.log('\nv0.52: la racha y sus hitos');
  check(R.HITOS_RACHA.join() === '4,8,12,26,52', 'hitos a las 4, 8, 12, 26 y 52 semanas');
  const p3 = R.proximoHito(3), p5 = R.proximoHito(5), p52 = R.proximoHito(52), p0 = R.proximoHito(0);
  check(p3.hito === 4 && p3.faltan === 1 && cerca(p3.frac, 0.75, 1e-9) && p5.hito === 8 && p5.anterior === 4 && cerca(p5.frac, 0.25, 1e-9) && p52.hito === 104 && p52.frac === 0 && p0.hito === 4 && p0.frac === 0,
    'la próxima meta y la barra (del hito anterior al siguiente; pasadas las 52, de 52 en 52)');
  check(R.hitoPorCelebrar(3, []) === null && R.hitoPorCelebrar(4, []) === 4 && R.hitoPorCelebrar(4, [4]) === null && R.hitoPorCelebrar(9, []) === 8 && R.hitoPorCelebrar(13, [4, 8]) === 12 && R.hitoPorCelebrar(13, [12]) === null,
    'se celebra el hito más alto alcanzado, una sola vez (llegar a 9 de golpe celebra el de 8)');
  check(R.marcarHitos(8, [4]).join() === '4,8' && R.marcarHitos(12, []).join() === '4,8,12' && R.marcarHitos(4, ['x', 99]).join() === '4', 'al celebrar uno, quedan vistos él y los de debajo (y nada raro de lo guardado)');
  const semR = [{ fecha_inicio: '2026-10-05', total: 3, hechas: 3 }, { fecha_inicio: '2026-10-12', total: 3, hechas: 2 }, { fecha_inicio: '2026-10-19', total: 3, hechas: 3 }, { fecha_inicio: '2026-10-26', total: 2, hechas: 2 }, { fecha_inicio: '2026-10-26', total: 1, hechas: 1 }, { fecha_inicio: '2026-11-02', total: 3, hechas: 1 }];
  const cal = R.calendarioRacha(semR, '2026-11-04', 6);
  check(cal.length === 6 && cal.map((w) => w.estado).join() === 'sin_plan,completa,incompleta,completa,completa,en_curso' && cal[4].total === 3 && cal[5].actual && cal[0].lunes === '2026-09-28',
    `el calendario: completas, sin completar, sin nada programado y la de ahora en curso (${cal.map((w) => w.estado).join(', ')})`);

  console.log('\nv0.52: destacados de Progreso');
  const hoyD = '2026-11-05'; // jueves
  const dias = {};
  for (const k of [1, 2, 3, 4]) { dias[`2026-10-${String(5 + 7 * (4 - k) - 0).padStart(2, '0')}`] = 4000; dias[`2026-10-${String(7 + 7 * (4 - k)).padStart(2, '0')}`] = 4000; }
  dias['2026-11-02'] = 5000; dias['2026-11-04'] = 4200;
  const td = D.destacados({ dias }, hoyD).find((x) => x.id === 'tonelaje');
  check(td && /llevas un 15 % más de tonelaje/.test(td.texto) && td.grafica.valores.length === 5 && td.grafica.resaltado === 4, `tonelaje: esta semana frente a la media de las 4 anteriores hasta el mismo día («${td?.texto}»)`);
  check(!D.destacados({ dias: { ...dias, '2026-11-04': 3000 } }, hoyD).some((x) => x.id === 'tonelaje') && !D.destacados({ dias: { '2026-11-02': 9000, '2026-10-26': 1000 } }, hoyD).some((x) => x.id === 'tonelaje'),
    'tonelaje: no sale si sube menos de un 10 % ni sin 3 semanas con que comparar');
  check(!D.destacados({ dias: { ...dias, '2026-11-04': 40000 } }, hoyD).some((x) => x.id === 'tonelaje'), 'tonelaje: tampoco si es más del triple (un dato raro, no una tendencia)');
  const ejD = [
    { id: 'pb', nombre: 'Press banca', puntos: [{ semana: '2026-09-28', valor: 70 }, { semana: '2026-10-05', valor: 71 }, { semana: '2026-10-19', valor: 72 }, { semana: '2026-11-02', valor: 73.2 }] },
    { id: 'sq', nombre: 'Sentadilla', puntos: [{ semana: '2026-10-26', valor: 90 }, { semana: '2026-11-02', valor: 96 }] },
  ];
  const fd = D.destacados({ ejercicios: ejD }, hoyD).find((x) => x.id === 'fuerza');
  check(fd && fd.texto === 'Tu press banca estimado ha subido 3 kg en 5 semanas.' && fd.ejercicioId === 'pb' && fd.grafica.valores.length === 4, `fuerza: el 1RM estimado de 6 semanas, en kilos redondeados a medio kilo («${fd?.texto}»)`);
  check(!D.destacados({ ejercicios: [{ id: 'x', nombre: 'Remo', puntos: [{ semana: '2026-10-05', valor: 60 }, { semana: '2026-10-19', valor: 61 }, { semana: '2026-11-02', valor: 61.5 }] }] }, hoyD).some((x) => x.id === 'fuerza'),
    'fuerza: con menos de 2,5 kg (o con solo dos semanas, como la sentadilla) no sale');
  const calR = R.calendarioRacha(semR, '2026-11-04', 8);
  check(D.destacados({ racha: 3, calendario: calR }, hoyD)[0]?.texto === 'Has entrenado 3 semanas seguidas completas.' && !D.destacados({ racha: 2, calendario: calR }, hoyD).length && D.destacados({ racha: 3, calendario: calR }, hoyD)[0].grafica.valores.length === 8,
    'racha: desde 3 semanas completas seguidas, con las 8 últimas semanas pintadas');
  const bl = (xs) => xs.map((h, i) => ({ numero: i + 1, hechas: h, total: 3 }));
  const bd = D.destacados({ bloque: bl([2, 2, 3, 3, 3]) }, hoyD).find((x) => x.id === 'bloque');
  check(bd && /mejor momento del bloque: el 100 %/.test(bd.texto) && !D.destacados({ bloque: bl([3, 3, 3, 3]) }, hoyD).length && !D.destacados({ bloque: bl([2, 3, 3]) }, hoyD).length && !D.destacados({ bloque: bl([3, 3, 2, 2, 3]) }, hoyD).length,
    'constancia del bloque: solo si las 3 últimas semanas son lo mejor del bloque (≥ 90 %) y mejor que antes (todo al 100 % desde el principio no es «su mejor momento»)');
  const rec = [{ ejercicio_id: 'pb', fecha: '2026-11-03' }, { ejercicio_id: 'sq', fecha: '2026-10-29' }, { ejercicio_id: 'pb', fecha: '2026-10-01' }];
  const rd = D.destacados({ recientes: rec, nombres: { pb: 'Press banca', sq: 'Sentadilla' } }, hoyD).find((x) => x.id === 'records');
  const rec3 = [...rec, { ejercicio_id: 'pb', fecha: '2026-11-04' }, { ejercicio_id: 'rm', fecha: '2026-11-04' }];
  check(rd && rd.texto === 'Has batido récords en press banca y en sentadilla en las 2 últimas semanas.' && !D.destacados({ recientes: rec.slice(0, 1), nombres: {} }, hoyD).length
    && !D.destacados({ recientes: [{ ejercicio_id: 'pb', fecha: '2026-11-03' }, { ejercicio_id: 'pb', fecha: '2026-11-04' }], nombres: {} }, hoyD).length
    && D.destacados({ recientes: rec3, nombres: { pb: 'Press banca' } }, hoyD)[0].texto === 'Has batido récords en 3 ejercicios en las 2 últimas semanas.', `récords: en al menos 2 ejercicios en 14 días (batir dos veces el mismo es uno) («${rd?.texto}»)`);
  const todos = D.destacados({ dias, ejercicios: ejD, racha: 3, calendario: calR, bloque: bl([2, 2, 3, 3, 3]), recientes: rec, nombres: { pb: 'Press banca', sq: 'Sentadilla' } }, hoyD);
  check(todos.length === 4 && new Set(todos.map((x) => x.id)).size === 4 && D.destacados({}, hoyD).length === 0, `como mucho 4, los más fuertes primero (${todos.map((x) => x.id).join(', ')}); sin datos, ninguno`);
  check(!/peso|kg de tendencia|kcal|salud|sueño/i.test(JSON.stringify(todos.map((x) => x.texto))), 'los destacados solo hablan de entrenamiento (nada de peso, salud ni nutrición)');
  const tps = D.tonelajePorSemana(D.tonelajePorDia([{ fecha: '2026-11-02', kg: 50, reps: 10 }, { fecha: '2026-11-04', kg: 40, reps: 5 }, { fecha: '2026-10-28', kg: 100, reps: 3 }, { fecha: '2026-10-28', kg: 100, reps: 0 }]));
  check(JSON.stringify(tps) === JSON.stringify([{ semana: '2026-10-26', valor: 300 }, { semana: '2026-11-02', valor: 700 }]), 'el tonelaje por semana (carga × repeticiones; las series sin repeticiones no cuentan)');

  console.log('\nv0.52: gráficas con rango y cuentakilómetros');
  const pts = [{ x: '2026-04-01', y: 1 }, { x: '2026-08-10', y: 2 }, { x: '2026-10-10', y: 3 }, { x: '2026-11-01', y: 4 }];
  check(G.filtrarRango(pts, '1m', '2026-11-04').length === 2 && G.filtrarRango(pts, '3m', '2026-11-04').length === 3 && G.filtrarRango(pts, '6m', '2026-11-04').length === 3 && G.filtrarRango(pts, 'todo', '2026-11-04').length === 4,
    '1M, 3M, 6M y Todo');
  const sem = [{ semana: '2026-10-05', valor: 1 }, { semana: '2026-10-26', valor: 2 }];
  check(G.filtrarRango(sem, '1m', '2026-11-04', { clave: 'semana', semanal: true }).length === 2 && G.RANGOS_GRAFICA.map(([, t]) => t).join() === '1M,3M,6M,Todo', 'por semanas, la semana empezada hace un mes cuenta entera');
  check(G.rangoConDatos(pts, '1m', '2026-11-04') === '1m' && G.rangoConDatos([{ x: '2026-01-01', y: 1 }, { x: '2026-06-01', y: 2 }], '1m', '2026-11-04') === 'todo', 'si el rango preferido no tiene 2 puntos, el siguiente que los tenga');
  const rem = G.remuestrear([[0, 0], [10, 10], [20, 0]], 5);
  check(rem.length === 5 && JSON.stringify(rem) === JSON.stringify([[0, 0], [5, 5], [10, 10], [15, 5], [20, 0]]) && G.remuestrear([[3, 7]], 3).every(([x, y]) => x === 3 && y === 7) && G.remuestrear([], 4).length === 0,
    'remuestrear una línea a n puntos repartidos por igual (interpolando)');
  const a = G.remuestrear([[0, 10], [100, 10]], 4), b = G.remuestrear([[0, 0], [50, 40], [100, 20]], 4);
  const m0 = G.mezclarPuntos(a, b, 0), m1 = G.mezclarPuntos(a, b, 1), mm = G.mezclarPuntos(a, b, 0.5);
  check(JSON.stringify(m0) === JSON.stringify(a) && JSON.stringify(m1) === JSON.stringify(b) && cerca(mm[1][1], (a[1][1] + b[1][1]) / 2, 1e-9), 'la mezcla de dos trazos: de uno al otro sin saltos');
  check(G.trazo([[0, 1], [2.25, 3]]) === 'M0.0 1.0 L2.3 3.0' && G.area([[0, 1], [2, 3]], 10) === 'M0.0 1.0 L2.0 3.0 L2.0 10 L0.0 10Z' && G.salidaSuave(0) === 0 && G.salidaSuave(1) === 1 && G.salidaSuave(0.5) > 0.5, 'el trazo, el área y la curva de salida');
  check(G.seleccionValida(5, 6) === 5 && G.seleccionValida(6, 6) === null && G.seleccionValida(11, 4) === null && G.seleccionValida(null, 4) === null && G.seleccionValida(-1, 4) === null && G.seleccionValida(0, 0) === null,
    'el punto elegido de una gráfica solo vale si existe (elegido el último y pasando a un rango con menos puntos, ninguno)');
  const c1 = G.columnasCifra('82,5'), c2 = G.columnasCifra('102,5');
  check(c1.map((x) => x.digito ?? x.c).join('|') === '8|2|,|5' && c1[3].clave === 1 && c2[4].clave === 1 && c2.find((x) => x.clave === 3).digito === 2 && c1.find((x) => x.clave === 3).digito === 2,
    'el cuentakilómetros alinea las cifras por la derecha (las unidades con las unidades); la coma no rueda');

  console.log('\nv0.52: carné, confeti y respiración');
  const dc = CA.datosCarnet({ atleta: { id: 'a1', nombre: 'Ana López', nivel: 'intermedio', fecha_alta: '2026-03-16', peso: 63, objetivo: 'bajar 3 kg' }, bloque: { numero: 2, nombre: 'Fuerza base' } });
  check(dc.nombre === 'Ana López' && dc.nivel === 'Intermedio' && dc.bloque === 'Bloque 2: Fuerza base' && dc.desde === 'marzo de 2026' && /^FBE·\d{6}$/.test(dc.numero) && CA.numeroCarnet('a1') === dc.numero && CA.numeroCarnet('a2') !== dc.numero,
    'el carné: nombre, nivel, bloque, desde cuándo y un número estable');
  check(Object.keys(dc).every((k) => CA.CAMPOS_CARNET.includes(k)) && !/63|bajar|kg/.test(JSON.stringify(dc)), 'y nada más: ni peso, ni objetivo, ni salud ni nutrición');
  const img = CA.datosImagenCarnet(CA.datosCarnet({ atleta: { id: 'a1', nombre: 'Ana López', nivel: 'intermedio', fecha_alta: '2026-03-16' }, bloque: { numero: 3, nombre: 'Rehabilitación de hombro' } }));
  check(!('bloque' in img) && !/Rehabilitaci|hombro/.test(JSON.stringify(img)) && img.nombre === 'Ana López' && img.desde === 'marzo de 2026' && Object.keys(img).join() === CA.CAMPOS_IMAGEN.join(),
    'la imagen para compartir no lleva el bloque (su nombre lo escribe el coach y podría decir algo de salud)');
  check(CA.fmtDesde('x') === null && CA.datosCarnet({ atleta: {} }).nombre === 'Atleta FBE' && CA.datosCarnet({ atleta: {} }).desde === null, 'sin datos, lo que se sabe');
  const inc = CA.inclinacion({ x: 0, y: 0, w: 200, h: 100 }), inc2 = CA.inclinacion({ x: 100, y: 50, w: 200, h: 100 });
  check(inc.rx === 8 && inc.ry === -8 && inc2.rx === 0 && inc2.ry === 0 && inc2.bx === 50 && CA.inclinacion({ x: 999, y: -5, w: 200, h: 100 }).ry === 8, 'la inclinación con el dedo: ±8° como mucho, y el brillo donde está el dedo');
  check(CA.inclinacionMovil(45, 0).rx === 0 && CA.inclinacionMovil(90, 60).ry === 8 && CA.inclinacionMovil(90, 60).rx === -8, 'con el móvil: respecto a como se tenía, y con tope');
  check(CF.cuantasParticulas({ nucleos: 8, memoria: 8, ancho: 390 }) === 140 && CF.cuantasParticulas({ nucleos: 4, memoria: 2, ancho: 360 }) < 70 && CF.cuantasParticulas({ nucleos: 2, memoria: 1, ancho: 320 }) >= CF.CONFETI.minimo && CF.escalaLienzo(3) === 2 && CF.escalaLienzo(0) === 1,
    'el confeti: menos partículas en móviles modestos y el lienzo a 2× como mucho');
  const ps = CF.crearParticulas(40, { ancho: 390, alto: 844, colores: ['#a', '#b'], semilla: 3 });
  const y0 = ps.map((q) => q.y);
  for (let i = 0; i < 90; i++) CF.moverParticulas(ps, 1 / 60);
  check(ps.length === 40 && ps.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)) && ps.filter((q, i) => q.y > y0[i]).length > 30 && ps.some((q) => q.x < 195) && ps.some((q) => q.x > 195), 'salen en abanico, las frena el aire y caen con la gravedad');
  const rapido = CF.crearParticulas(1, { ancho: 390, alto: 844, colores: ['#a'] });
  const yA = rapido[0].y; CF.moverParticulas(rapido, 5);
  check(Math.abs(rapido[0].y - yA) < 100 && CF.opacidadConfeti(0) === 1 && CF.opacidadConfeti(CF.CONFETI.duracion) === 0 && CF.CONFETI.duracion === 2500, 'un salto de tiempo enorme (el móvil se congela) no las dispara; se desvanece y acaba a los 2,5 s');
  const r0 = RS.faseRespira(0), r2 = RS.faseRespira(2), r4 = RS.faseRespira(4), r7 = RS.faseRespira(7), r10 = RS.faseRespira(10);
  check(r0.fase === 'inspira' && r0.escala === RS.ESCALA_RESPIRA.min && r2.fase === 'inspira' && cerca(r2.escala, (RS.ESCALA_RESPIRA.min + 1) / 2, 0.01) && r4.fase === 'suelta' && r4.escala === 1 && r7.fase === 'suelta' && r10.fase === 'inspira' && r10.ciclo === 1,
    'respirar: 4 s inspirando (el círculo crece) y 6 s soltando (encoge), contados desde que empieza el descanso');
  check(RS.retrasoRespira(13) === -3 && RS.retrasoRespira(0) === -0 && RS.CICLO_RESPIRA === 10 && RS.faseRespira(4).texto === 'Suelta' && RS.faseRespira(1).texto === 'Inspira', 'el retraso de la animación la acompasa con la cuenta atrás');
  check(V.paresValidos([{ nombre: 'vt-avatar', desde: {}, hasta: '.x' }, { nombre: 'vt-avatar', desde: {}, hasta: '.y' }, { nombre: 'otro', desde: {}, hasta: '.z' }, { nombre: 'vt-ej-picto', desde: null, hasta: '.w' }]).length === 1,
    'elemento compartido: un nombre nunca va en dos elementos (el segundo se descarta), y solo los nombres previstos');
  check(V.seVe({ top: 10, left: 0, bottom: 50, right: 100, width: 100, height: 40 }, 390, 844) && !V.seVe({ top: 900, left: 0, bottom: 950, right: 100, width: 100, height: 50 }, 390, 844) && !V.seVe(null, 1, 1), 'solo se transforma si el origen se ve en la pantalla');

  console.log('\nv0.52: preferencias del móvil sin almacenamiento');
  const PR = await import('../web/src/ui/preferencias.js');
  const lsPrevio = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  PR.guardarPreferencia('fbe-hitos-racha-x', [4]);
  const sinAlm = PR.leerPreferencia('fbe-hitos-racha-x', []);
  check(JSON.stringify(sinAlm) === '[4]' && R.hitoPorCelebrar(4, sinAlm) === null && JSON.stringify(PR.leerPreferencia('otra', 'de serie')) === '"de serie"',
    'si el navegador no deja guardar, lo guardado (un hito celebrado) se recuerda mientras la app está abierta: no se repite');
  const guardado = {};
  globalThis.localStorage = { getItem: (k) => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = v; } };
  PR.guardarPreferencia('fbe-pista-x', true);
  check(guardado['fbe-pista-x'] === 'true' && PR.leerPreferencia('fbe-pista-x', false) === true, 'con almacenamiento, en el almacenamiento');
  if (lsPrevio === undefined) delete globalThis.localStorage; else globalThis.localStorage = lsPrevio;

  console.log('\nv0.52: CSS, ajustes y privacidad');
  check(/@supports \(animation-timeline: scroll\(\)\)/.test(css) && /animation-timeline: (scroll|view)\(/.test(css) && /prefers-reduced-motion: no-preference\) \{\s*@supports \(animation-timeline: scroll\(\)\)|@supports \(animation-timeline: scroll\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\)/.test(css),
    'las animaciones con el scroll van dentro de @supports y solo sin «reducir movimiento»');
  const bloque52 = css.slice(css.indexOf('v0.52: diez mejoras'));
  const keyframes52 = [...bloque52.matchAll(/@keyframes ([\w-]+) \{([^@]*?)\}\s*\}/g)];
  check(keyframes52.length >= 5 && keyframes52.every(([, , cuerpo]) => !/(^|[\s{;])(width|height|top|left|right|bottom|margin|padding)\s*:/.test(cuerpo)), `las animaciones nuevas solo mueven transform, translate, scale u opacity (${keyframes52.length} keyframes)`);
  const deTexto = ['hito-sube', 'racha-cifra', 'encurso-entra', 'destacado-entra'];
  check(deTexto.every((k) => keyframes52.some(([, n, cuerpo]) => n === k && !/opacity/.test(cuerpo))), 'las entradas de lo que lleva texto (el hito, la cifra de la racha, la píldora, los destacados) solo se mueven: sin opacidad (axe podría medirlas a medias)');
  const aj = await import('../web/src/ui/ajustes.js');
  check(aj.AJUSTES_DEFECTO.respira === false && aj.normalizarAjustes({ respira: 'si' }).respira === false && aj.normalizarAjustes({ respira: true }).respira === true, '«Respira» va apagado de entrada y se guarda en el móvil');
  const legal = await import('../web/src/legal.js');
  const filaL = legal.PRIVACIDAD.find(([t]) => t === 'Lo que se queda en tu móvil');
  check(/kilos y las repeticiones que te propone/.test(filaL[1]) && /al cerrar la sesión/.test(filaL[1]), '«Lo que se queda en tu móvil» dice exactamente lo que guarda la píldora (también los kilos propuestos) y que se borra al cerrar la sesión');
  check(!/(^|\n|\}|,)\s*\.destacado\s*[{,:]/.test(bloque52) && /\.destacados-lista > \.destacado \{/.test(bloque52), 'las tarjetas de destacados solo dentro de su lista (el diario ya usa «.destacado» para sus vídeos)');
  check(/Respira/.test(filaL[1]) && /hitos de la racha/.test(filaL[1]) && /^\d{4}-\d{2}(\.[1-9])?$/.test(legal.VERSION_LEGAL), '«Lo que se queda en tu móvil» dice «Respira» y los hitos ya celebrados (sin cambiar la versión de la política)');
}
{
  console.log('\nv0.52.2: descansos cuando el coach no los pone');
  const C = await import('../web/src/logica/calculos.js');
  const { descansoEfectivo, resolverDescanso, limpiarDescansos, trasSerie, descansoGrupo, gruposSuperserie, DESCANSOS_ATLETA, textoDescanso } = C;
  check(DESCANSOS_ATLETA.join() === '0,60,90,120,150,180,240,300' && C.DESCANSO_DEFECTO === 120, 'las opciones: sin descanso automático, 1:00, 1:30, 2:00, 2:30, 3:00, 4:00 y 5:00 (de serie, 2:00)');
  const conCoach = { id: 'a', ejercicio_id: 'ea', descanso_seg: 150 }, sinCoach = { id: 'b', ejercicio_id: 'eb', descanso_seg: null };
  const r1 = descansoEfectivo(conCoach, { propio: 90, defecto: 120 });
  check(r1.seg === 150 && r1.origen === 'coach', 'manda el del coach (aunque el atleta haya elegido otro para ese ejercicio)');
  const r2 = descansoEfectivo(sinCoach, { propio: 90, defecto: 120 });
  check(r2.seg === 90 && r2.origen === 'propio', 'sin el del coach, el que eligió el atleta para ese ejercicio');
  const r3 = descansoEfectivo(sinCoach, { propio: null, defecto: 120 });
  check(r3.seg === 120 && r3.origen === 'defecto', 'sin ninguno de los dos, el de por defecto');
  const r4 = descansoEfectivo(sinCoach, { propio: null, defecto: null });
  check(r4.seg === null && r4.origen === null, 'y sin por defecto, sin temporizador');
  const r5 = descansoEfectivo(sinCoach, { propio: null, defecto: 0 });
  check(r5.seg === null && r5.origen === 'defecto', '«Sin descanso automático» de por defecto: sin temporizador');
  const r6 = descansoEfectivo(sinCoach, { propio: 0, defecto: 120 });
  check(r6.seg === null && r6.origen === 'propio', 'sin descanso para un ejercicio en concreto, aunque el de por defecto sea 2:00');
  const r7 = descansoEfectivo({ descanso_seg: 0 }, { propio: 90, defecto: 120 });
  check(r7.seg === null && r7.origen === 'coach', 'el «Sin descanso» del coach (0) también manda: sin temporizador, como siempre');
  check(descansoEfectivo({ descanso_seg: undefined }, { defecto: 60 }).seg === 60 && descansoEfectivo({}, { defecto: 60 }).origen === 'defecto', 'sin el campo, como sin el del coach');
  // Lo guardado que no vale se ignora
  const malos = [45, '90', 90.5, -60, 600, NaN, true, {}, [90]];
  check(malos.every((m) => { const x = descansoEfectivo(sinCoach, { propio: m, defecto: 120 }); return x.seg === 120 && x.origen === 'defecto'; }), 'un descanso guardado que no es de la lista (45 s, «90», 600 s…) se ignora: vale el de por defecto');
  check(malos.every((m) => descansoEfectivo(sinCoach, { propio: null, defecto: m }).seg === null), 'y un por defecto que no es de la lista, también');
  const limpio = limpiarDescansos({ eb: 90, ec: 45, ed: '120', ee: 0, ['x'.repeat(65)]: 60, ef: 300 });
  check(JSON.stringify(limpio) === JSON.stringify({ eb: 90, ee: 0, ef: 300 }) && JSON.stringify(limpiarDescansos(null)) === '{}' && JSON.stringify(limpiarDescansos([90])) === '{}' && JSON.stringify(limpiarDescansos('90')) === '{}',
    'lo guardado en el móvil se sanea: solo ejercicios con un descanso de la lista');
  check(textoDescanso(90) === '1:30' && textoDescanso(0) === 'sin descanso automático' && textoDescanso(null, { delCoach: true }) === 'sin descanso', 'en texto: «1:30», «sin descanso automático» y el del coach «sin descanso»');

  // En trasSerie, con el resolvedor
  const res = resolverDescanso({ propios: { eb: 90 }, defecto: 120 });
  check(res(conCoach) === 150 && res(sinCoach) === 90 && res({ id: 'c', ejercicio_id: 'ec' }) === 120 && resolverDescanso({ propios: { constructor: 90 } })({ ejercicio_id: 'constructor' }) === 90
    && resolverDescanso({ propios: {} })({ ejercicio_id: 'toString' }) === null, 'el resolvedor: del coach, propio, por defecto (y nada heredado del prototipo)');
  const lista = [{ ...sinCoach, series: 3 }, { ...conCoach, series: 3 }, { id: 'c', ejercicio_id: 'ec', descanso_seg: null, series: 3 }];
  check(trasSerie(lista, { b: 1 }, 'b').descanso === null && trasSerie(lista, { a: 1 }, 'a').descanso === 150, 'sin resolvedor, trasSerie hace lo de siempre (solo el del coach)');
  check(trasSerie(lista, { b: 1 }, 'b', res).descanso === 90 && trasSerie(lista, { a: 1 }, 'a', res).descanso === 150 && trasSerie(lista, { c: 1 }, 'c', res).descanso === 120,
    'con él, tras una serie: el propio (1:30), el del coach (2:30) o el de por defecto (2:00)');
  check(trasSerie(lista, { c: 1 }, 'c', resolverDescanso({ defecto: 0 })).descanso === null, 'con «Sin descanso automático», sin temporizador');
  // Superseries: el mayor de los que valen para cada uno; dentro de la ronda, sin descanso
  const ss = [{ id: 's1', ejercicio_id: 'e1', superserie: 'A', descanso_seg: 60, series: 3 }, { id: 's2', ejercicio_id: 'e2', superserie: 'A', descanso_seg: null, series: 3 }];
  const g = gruposSuperserie(ss)[0];
  check(descansoGrupo(g) === 60 && descansoGrupo(g, resolverDescanso({ defecto: 120 })) === 120 && descansoGrupo(g, resolverDescanso({ propios: { e2: 0 }, defecto: 120 })) === 60
    && descansoGrupo(g, resolverDescanso({ propios: { e2: 300 } })) === 300, 'en una superserie, el mayor de los descansos que valen para cada uno');
  const ss2 = ss.map((x) => ({ ...x, descanso_seg: null }));
  check(descansoGrupo(gruposSuperserie(ss2)[0], resolverDescanso({ defecto: 0 })) === null && descansoGrupo(gruposSuperserie(ss2)[0], resolverDescanso({ propios: { e1: 90 }, defecto: 0 })) === 90, 'sin ninguno, sin descanso; con uno propio, ese');
  const enRonda = trasSerie(ss2, { s1: 1 }, 's1', resolverDescanso({ defecto: 120 }));
  const finRonda = trasSerie(ss2, { s1: 1, s2: 1 }, 's2', resolverDescanso({ propios: { e1: 150 }, defecto: 120 }));
  check(enRonda.descanso === 0 && enRonda.enRonda && enRonda.siguiente.id === 's2' && finRonda.descanso === 150 && !finRonda.enRonda && finRonda.siguiente.id === 's1',
    'de A1 a A2, sin descanso (0); al cerrar la ronda, el mayor (2:30 elegido frente a 2:00 por defecto)');

  // El ajuste del móvil
  const aj = await import('../web/src/ui/ajustes.js');
  check(aj.AJUSTES_DEFECTO.descansoDefecto === 120 && aj.normalizarAjustes({}).descansoDefecto === 120 && aj.normalizarAjustes({ descansoDefecto: 0 }).descansoDefecto === 0
    && aj.normalizarAjustes({ descansoDefecto: 300 }).descansoDefecto === 300, '«Descanso si tu coach no lo pone»: 2:00 de serie; se guarda cualquiera de la lista (también sin descanso)');
  check([45, '90', 600, null, -1, 'sin'].every((v) => aj.normalizarAjustes({ descansoDefecto: v }).descansoDefecto === 120), 'y uno que no es de la lista vuelve a 2:00');

  // Lo de cada ejercicio, en el móvil (fbe-descansos-<atleta>), con su copia en memoria
  const D = await import('../web/src/ui/descansos.js');
  const lsPrevio = globalThis.localStorage;
  const guardado = { 'fbe-descansos-at2': JSON.stringify({ e1: 90, e2: 45, e3: 'x' }) };
  globalThis.localStorage = { getItem: (k) => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = v; } };
  check(JSON.stringify(D.leerDescansos('at2')) === '{"e1":90}', 'al leer lo guardado, lo que no vale se ignora');
  D.guardarDescanso('at1', 'e1', 90);
  D.guardarDescanso('at1', 'e2', 0);
  check(JSON.parse(guardado['fbe-descansos-at1']).e1 === 90 && JSON.parse(guardado['fbe-descansos-at1']).e2 === 0 && D.leerDescansos('at1').e1 === 90, 'se guarda por atleta y por ejercicio');
  const m = D.guardarDescanso('at1', 'e1', null);
  check(!('e1' in m) && m.e2 === 0 && !('e1' in JSON.parse(guardado['fbe-descansos-at1'])), '«Usar el de por defecto» lo quita');
  check(!('e9' in D.guardarDescanso('at1', 'e9', 45)), 'uno que no es de la lista no se guarda');
  globalThis.localStorage = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); } };
  D.guardarDescanso('at3', 'e1', 150);
  check(D.leerDescansos('at3').e1 === 150 && JSON.stringify(D.leerDescansos('at4')) === '{}', 'si el navegador no deja guardar, se recuerda mientras la app está abierta');
  if (lsPrevio === undefined) delete globalThis.localStorage; else globalThis.localStorage = lsPrevio;

  const legal = await import('../web/src/legal.js');
  const filaL = legal.PRIVACIDAD.find(([t]) => t === 'Lo que se queda en tu móvil');
  check(/Los descansos que eliges tú .* se guardan en tu móvil/.test(filaL[1]) && /^\d{4}-\d{2}(\.[1-9])?$/.test(legal.VERSION_LEGAL), '«Lo que se queda en tu móvil» dice que los descansos que eliges se guardan en tu móvil (sin cambiar la versión de la política)');
}
console.log('\nv0.53: días de entreno por semana (microciclos que no caben en una semana natural)');
{
  const N = await import('../web/src/logica/semana-natural.js');
  const { racha, resumenAtleta } = await import('../web/src/logica/calculos.js');
  const { rachaMaxima } = await import('../web/src/logica/logros.js');
  const { semanasCompletas } = await import('../web/src/logica/diseno.js');
  const { calendarioRacha } = await import('../web/src/logica/racha.js');
  const { resumenMes, sumarMes } = await import('../web/src/logica/mes.js');
  const { dialConstancia, anillosSemana } = await import('../web/src/logica/tablero.js');
  const { cumplimiento } = await import('../web/src/logica/informe.js');
  const { semillaDemo } = await import('../web/src/datos/semilla-demo.js');

  check(N.diasSemanaValido(3) === 3 && N.diasSemanaValido('7') === 7 && N.diasSemanaValido(null) === null && N.diasSemanaValido('') === null
    && [0, 8, -1, 2.5, 'tres', undefined, NaN].every((v) => N.diasSemanaValido(v) === null), 'el objetivo vale de 1 a 7; cualquier otra cosa es «Automático» (null)');
  check(N.textoDiasSemana(1) === '1 día por semana' && N.textoDiasSemana(3) === '3 días por semana', 'su texto');

  // --- Sin objetivo, exactamente lo de antes: contra las funciones de siempre, en la demo de 7 días seguidos ---
  // (la lista de antes, como la montaban constancia(), logros() y resumenesSemanales(): una fila por semana del programa)
  const antes = (semanas, sesiones) => semanas.map((w) => {
    const ss = sesiones.filter((x) => x.semana_id === w.id);
    return { fecha_inicio: w.fecha_inicio, total: ss.length, hechas: ss.filter((x) => x.completada).length };
  });
  let comparadas = 0, distintas = [];
  for (let d = 0; d < 7; d++) {
    const hoySemilla = sumarDias('2026-11-02', d);
    const db = semillaDemo(hoySemilla);
    for (const a of db.atletas) {
      const bloques = db.bloques.filter((x) => x.atleta_id === a.id && !x.es_plantilla && x.estado !== 'cancelado');
      const semanas = db.semanas.filter((w) => bloques.some((x) => x.id === w.bloque_id) && w.programacion === 'programada' && w.fecha_inicio);
      const sesiones = db.sesiones.filter((x) => semanas.some((w) => w.id === x.semana_id));
      const viejo = antes(semanas, sesiones);
      const nuevo = N.paraRacha(N.semanasObjetivo({ diasSemana: null, sesiones, semanas, hoy: hoySemilla }));
      const lunesViejo = viejo.map((w) => ({ ...w, fecha_inicio: lunesDe(w.fecha_inicio) }));
      const L = new Map(semanas.map((w) => [w.id, lunesDe(w.fecha_inicio)]));
      const conLunes = sesiones.map((x) => ({ ...x, semana_lunes: L.get(x.semana_id) }));
      for (const h of [-21, -8, -1, 0, 3, 6, 13].map((k) => sumarDias(hoySemilla, k))) {
        comparadas++;
        const mes = h.slice(0, 7);
        const mV = resumenMes({ sesiones: conLunes }, sumarMes(mes, -1)), mN = resumenMes({ sesiones: conLunes, semanasNaturales: N.semanasObjetivo({ diasSemana: null, sesiones, semanas, hoy: h }) }, sumarMes(mes, -1));
        const ok1 = racha(viejo, h) === racha(nuevo, h) && rachaMaxima(viejo, h) === rachaMaxima(nuevo, h) && semanasCompletas(lunesViejo, h) === semanasCompletas(nuevo, h)
          && igual(calendarioRacha(viejo, h, 12), calendarioRacha(nuevo, h, 12))
          && igual([mV.semanasCompletas, mV.mejorRacha, mV.racha], [mN.semanasCompletas, mN.mejorRacha, mN.racha]);
        if (!ok1) distintas.push(`${a.nombre} ${h}`);
      }
    }
  }
  check(comparadas >= 7 * 7 * 5 && !distintas.length, `sin objetivo, racha, racha más larga, semanas completas, el calendario de la racha y «Tu mes» salen igual que antes (${comparadas} comparaciones en la demo de 7 días distintos)${distintas.length ? `: distintas ${distintas.slice(0, 3).join(', ')}` : ''}`);
  {
    const db = semillaDemo('2026-11-05');
    const a = db.atletas.find((x) => x.nombre === 'Ana López');
    const bl = db.bloques.filter((x) => x.atleta_id === a.id);
    const semanas = db.semanas.filter((w) => bl.some((x) => x.id === w.bloque_id) && w.programacion === 'programada');
    const sesiones = db.sesiones.filter((x) => semanas.some((w) => w.id === x.semana_id));
    const l = N.semanasObjetivo({ sesiones, semanas, hoy: '2026-11-05' });
    const act = N.semanaEnCurso(l, '2026-11-05');
    const ses = sesiones.filter((x) => x.semana_id === semanas.find((w) => w.fecha_inicio === '2026-11-02').id);
    check(!!act && act.objetivo === ses.length && act.hechas === ses.filter((x) => x.completada).length && igual(dialConstancia(ses), dialConstancia(ses, act)),
      'sin objetivo, la semana de hoy es la programada (el dial de Hoy, el mismo con una lista que con la otra)');
  }

  // --- Con objetivo: Dani, 3 días por semana, microciclos de 4 sesiones con las fechas de 7 en 7 ---
  // Bloque desde el lunes 7 de septiembre, 6 semanas del programa (24 sesiones); entrena lunes, miércoles y viernes
  const micro = (inicio = '2026-09-07', nSemanas = 6, bloque = 'b1', base = 0) => {
    const semanas = Array.from({ length: nSemanas }, (_, i) => ({ id: `${bloque}-w${i + 1}`, numero: i + 1, bloque_id: bloque, fecha_inicio: sumarDias(inicio, 7 * i), programacion: 'programada' }));
    const sesiones = semanas.flatMap((w) => [1, 2, 3, 4].map((o) => ({ id: `${w.id}-s${o}`, semana_id: w.id, orden: o, nombre: ['Torso A', 'Pierna A', 'Torso B', 'Pierna B'][o - 1], completada: false, fecha_realizada: null })));
    return { semanas, sesiones };
  };
  const hacer = (sesiones, fechas) => { let k = 0; for (const s of sesiones) { if (k >= fechas.length) break; if (s.completada) continue; Object.assign(s, { completada: true, fecha_realizada: fechas[k++] }); } };
  const lxv = (lunes) => [0, 2, 4].map((o) => sumarDias(lunes, o));
  {
    const { semanas, sesiones } = micro();
    // 5 semanas naturales enteras (15 sesiones: 3 microciclos y 3 del cuarto) y hoy, el lunes de la sexta, una más
    hacer(sesiones, [...[0, 1, 2, 3, 4].flatMap((k) => lxv(sumarDias('2026-09-07', 7 * k))), '2026-10-12']);
    const hoy = '2026-10-12';
    const l = N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy });
    check(l.length === 6 && l.slice(0, 5).every((w) => w.objetivo === 3 && w.hechas === 3 && w.completa) && igual(l[5], { lunes: '2026-10-12', objetivo: 3, hechas: 1, completa: false }),
      'con 3 días: cada semana de lunes a domingo, 3 de 3 (aunque los microciclos de 4 crucen de una semana a otra); la de hoy, 1 de 3');
    const lista = N.paraRacha(l);
    check(racha(lista, hoy) === 5 && rachaMaxima(lista, hoy) === 5 && semanasCompletas(lista, hoy) === 5, 'racha de 5 semanas completas seguidas (la de hoy, a medias, no la rompe)');
    const viejo = N.paraRacha(N.semanasObjetivo({ sesiones, semanas, hoy }));
    check(racha(viejo, hoy) === 0 && viejo.filter((w) => w.fecha_inicio < '2026-10-12').every((w) => w.total === 4), 'con «Automático», la de siempre: semanas de 4 que casi nunca se completan (racha 0)');
    check(dialConstancia([], N.semanaEnCurso(l, hoy)).cifra === '1/3' && dialConstancia([], N.semanaEnCurso(l, hoy)).etiqueta === 'Te quedan 2', 'el dial de Hoy: «1/3, Te quedan 2» (no «1/4, Te quedan 3»)');
    const an = anillosSemana({ semanaNatural: N.semanaEnCurso(l, hoy), conCheckin: false });
    check(an[0].texto === '1 de 3' && !an[0].cerrado && anillosSemana({ semanaNatural: null, conCheckin: false })[0].objetivo === 0, 'el anillo de sesiones va hasta 3 (y sin nada que hacer, vacío)');
    // Termina la semana: miércoles y viernes
    hacer(sesiones, ['2026-10-14', '2026-10-16']);
    const l2 = N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy: '2026-10-16' });
    check(racha(N.paraRacha(l2), '2026-10-16') === 6 && N.semanaEnCurso(l2, '2026-10-16').completa && dialConstancia([], N.semanaEnCurso(l2, '2026-10-16')).etiqueta === 'Semana completa',
      'la semana en curso suma en cuanto llega a 3 (racha 6, «Semana completa»)');
    // Hoy sigue en su microciclo: el 5.º (18 hechas), aunque por fechas tocaría el 6.º
    const porSemana = Object.fromEntries(semanas.map((w) => [w.id, sesiones.filter((x) => x.semana_id === w.id)]));
    const m = N.semanaDelMicrociclo(semanas, porSemana, semanas[5]);
    check(m.numero === 5 && porSemana[m.id].filter((x) => !x.completada).map((x) => x.nombre).join() === 'Torso B,Pierna B', 'Hoy enseña su microciclo (el 5.º, con Torso B y Pierna B pendientes), no el de las fechas');
    const lista5 = N.sesionesDeLaSemana(semanas, porSemana, 3, '2026-10-16');
    check(lista5.length === 3 && lista5.every((x) => x.completada) && lista5.map((x) => x.fecha_realizada).join() === '2026-10-12,2026-10-14,2026-10-16', 'la hoja de la constancia: las 3 hechas de esta semana (de dos microciclos)');
    check(N.sesionesDeLaSemana(semanas, porSemana, 3, '2026-10-19').map((x) => x.nombre).join() === 'Torso B,Pierna B,Torso A', 'y el lunes siguiente, las 3 que le tocan en su orden (cruzando al microciclo siguiente)');
    const todoHecho = Object.fromEntries(semanas.map((w) => [w.id, porSemana[w.id].map((x) => ({ ...x, completada: true }))]));
    check(N.semanaDelMicrociclo(semanas, todoHecho, semanas[5]) === semanas[5], 'con todo hecho, la de siempre');
  }
  {
    // Lunes y domingo: el domingo cuenta en su semana; el lunes siguiente, en la siguiente
    const { semanas, sesiones } = micro('2026-09-07', 3);
    hacer(sesiones, ['2026-09-07', '2026-09-09', '2026-09-13', '2026-09-14', '2026-09-20', '2026-09-21']);
    const l = N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy: '2026-09-22' });
    check(igual(l.map((w) => [w.lunes, w.hechas]), [['2026-09-07', 3], ['2026-09-14', 2], ['2026-09-21', 1]]) && l[0].completa && !l[1].completa,
      'el domingo cuenta en su semana y el lunes, en la siguiente (semanas de lunes a domingo)');
    check(racha(N.paraRacha(l), '2026-09-22') === 0 && rachaMaxima(N.paraRacha(l), '2026-09-22') === 1, 'una semana de 2 rompe la racha; la de hoy (1) no');
    // Una sesión sin fecha cuenta el día que empezó su semana
    const otra = micro('2026-09-07', 1);
    Object.assign(otra.sesiones[0], { completada: true, fecha_realizada: null });
    check(N.semanasObjetivo({ diasSemana: 1, ...otra, hoy: '2026-09-10' })[0].hechas === 1, 'una sesión hecha sin fecha cuenta en la semana en que empezó la suya');
  }
  {
    // Antes del bloque, nada; un bloque que empieza un jueves cuenta desde esa semana
    const { semanas, sesiones } = micro('2026-09-10', 2);
    const l = N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy: '2026-09-21' });
    check(l[0].lunes === '2026-09-07' && l.length === 3 && N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy: '2026-09-01' }).length === 0, 'las semanas de antes de su primer bloque no cuentan (empieza la del jueves en que arranca)');
    check(!N.semanasObjetivo({ diasSemana: 3, sesiones: [], semanas: [], hoy: '2026-09-21' }).length && !N.semanasObjetivo({ diasSemana: 3, sesiones, semanas: [], hoy: '2026-09-21' }).length, 'sin programa, ninguna');
  }
  {
    // Huecos: un bloque terminado, dos semanas de descanso y el siguiente: no rompen la racha
    const a = micro('2026-09-07', 3, 'b1');
    hacer(a.sesiones, [...[0, 1, 2].flatMap((k) => lxv(sumarDias('2026-09-07', 7 * k))), '2026-09-28', '2026-09-30', '2026-10-02']);
    const b = micro('2026-10-19', 2, 'b2');
    hacer(b.sesiones, [...lxv('2026-10-19'), ...lxv('2026-10-26')]);
    const sem = [...a.semanas, ...b.semanas], ses = [...a.sesiones, ...b.sesiones];
    const l = N.semanasObjetivo({ diasSemana: 3, sesiones: ses, semanas: sem, hoy: '2026-10-28' });
    check(!l.some((w) => w.lunes === '2026-10-05' || w.lunes === '2026-10-12') && racha(N.paraRacha(l), '2026-10-28') === 6,
      'las semanas sin nada que hacer (descanso entre bloques) ni suman ni rompen: 4 + 2 semanas seguidas');
    // Sin entrenar con sesiones pendientes, sí rompe
    const c = micro('2026-09-07', 4);
    hacer(c.sesiones, [...lxv('2026-09-07'), ...lxv('2026-09-21')]);
    const lc = N.semanasObjetivo({ diasSemana: 3, ...c, hoy: '2026-09-23' });
    check(igual(lc.map((w) => [w.lunes, w.hechas, w.completa]), [['2026-09-07', 3, true], ['2026-09-14', 0, false], ['2026-09-21', 3, true]]) && racha(N.paraRacha(lc), '2026-09-23') === 1,
      'una semana sin entrenar con sesiones pendientes sí rompe la racha');
    // Al final del bloque, el objetivo es lo que queda (1 de 1)
    const d = micro('2026-09-07', 1);
    hacer(d.sesiones, lxv('2026-09-07'));
    const ld = N.semanasObjetivo({ diasSemana: 3, ...d, hoy: '2026-09-15' });
    check(igual(ld[1], { lunes: '2026-09-14', objetivo: 1, hechas: 0, completa: false }), 'al final del bloque, si solo le queda 1, su objetivo esa semana es 1');
    hacer(d.sesiones, ['2026-09-15']);
    check(N.semanasObjetivo({ diasSemana: 3, ...d, hoy: '2026-09-15' })[1].completa && N.semanasObjetivo({ diasSemana: 3, ...d, hoy: '2026-09-22' }).length === 2, 'hecha, completa; y la semana siguiente, sin nada que hacer, no sale');
    // Las pendientes de un bloque viejo dejan de contar al empezar el siguiente
    const e = micro('2026-09-07', 2, 'v');
    hacer(e.sesiones, lxv('2026-09-07'));
    const f = micro('2026-09-28', 1, 'n');
    hacer(f.sesiones, lxv('2026-09-28'));
    const le = N.semanasObjetivo({ diasSemana: 3, sesiones: [...e.sesiones, ...f.sesiones], semanas: [...e.semanas, ...f.semanas], hoy: '2026-10-05' });
    check(igual(le.map((w) => [w.lunes, w.objetivo, w.hechas]), [['2026-09-07', 3, 3], ['2026-09-14', 3, 0], ['2026-09-21', 3, 0], ['2026-09-28', 3, 3], ['2026-10-05', 1, 0]]),
      'las pendientes de un bloque cuentan hasta que empieza el siguiente (después, solo las del nuevo)');
    // Una sesión repetida en la lista cuenta una vez; 4 en una semana con objetivo 3, completa (y 4 hechas)
    const g = micro('2026-09-07', 2);
    hacer(g.sesiones, ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10']);
    const lg = N.semanasObjetivo({ diasSemana: 3, sesiones: [...g.sesiones, g.sesiones[0]], semanas: g.semanas, hoy: '2026-09-11' });
    check(igual(lg, [{ lunes: '2026-09-07', objetivo: 3, hechas: 4, completa: true }]) && dialConstancia([], lg[0]).valor === 1, 'sesiones distintas: una repetida cuenta una vez; 4 de 3, completa (el dial, lleno)');
  }
  {
    // «Tu mes» con su objetivo; el cumplimiento de lo hecho; el resumen del panel
    const { semanas, sesiones } = micro('2026-09-28', 6);
    hacer(sesiones, [...[0, 1, 2, 3].flatMap((k) => lxv(sumarDias('2026-09-28', 7 * k))), '2026-10-26']);
    const nat = N.semanasObjetivo({ diasSemana: 3, sesiones, semanas, hoy: '2026-11-02' });
    const L = new Map(semanas.map((w) => [w.id, w.fecha_inicio]));
    const r = resumenMes({ sesiones: sesiones.map((x) => ({ ...x, semana_lunes: L.get(x.semana_id) })), semanasNaturales: nat }, '2026-10');
    const r0 = resumenMes({ sesiones: sesiones.map((x) => ({ ...x, semana_lunes: L.get(x.semana_id) })) }, '2026-10');
    check(r.semanasCompletas === 4 && r.mejorRacha === 4 && r.sesiones.previstas === 15 && r.sesiones.hechas === 11 && r0.semanasCompletas === 3 && r0.sesiones.previstas === 20,
      '«Tu mes» de octubre: 4 semanas completas seguidas, 11 sesiones de 15 previstas (con «Automático», 3 completas de 20 previstas: las del programa)');
    const ses = [{ id: 'a', completada: true, semana_lunes: '2026-10-05' }, { id: 'b', completada: false, semana_lunes: '2026-10-05' }];
    const pautas = [{ id: 'pa', sesion_id: 'a', series: 3 }, { id: 'pb', sesion_id: 'b', series: 3 }];
    const series = [{ sesion_ejercicio_id: 'pa', reps: 5 }, { sesion_ejercicio_id: 'pa', reps: 5 }];
    check(cumplimiento({ sesiones: ses, pautas, series }, '2026-11-02').series.pct === 33 && cumplimiento({ sesiones: ses, pautas, series, soloHechas: true }, '2026-11-02').series.pct === 67,
      'por microciclos, el cumplimiento de un microciclo es el de sus sesiones hechas (sus fechas no dicen qué tocaba)');
    const base = { atleta: { id: 'x', nombre: 'Dani', estado: 'activo' }, bloque: null, semanas: [], semana: null, sesiones: [{ completada: true }, { completada: false }, { completada: false }, { completada: false }], checkins: [{ semana_inicio: '2026-10-26' }] };
    const r1 = resumenAtleta(base, '2026-11-04'), r2 = resumenAtleta({ ...base, diasSemana: 3, semanaNatural: { lunes: '2026-11-02', objetivo: 3, hechas: 2, completa: false } }, '2026-11-04');
    check(igual(r1.sesiones, { completadas: 1, total: 4 }) && r1.diasSemana === null && igual(r2.sesiones, { completadas: 2, total: 3 }) && r2.diasSemana === 3,
      'en el panel del coach, «2/3» de su semana natural (sin objetivo, «1/4» de la programada, como antes)');
  }
}
{
  console.log('\nEl chat como WhatsApp (v0.54): formato, citas, sin leer, búsqueda, reacciones, ventanas y borradores');
  const F = await import('../web/src/logica/formato.js');
  const M = await import('../web/src/logica/mensajes.js');
  const tk = F.tokensFormato;
  check(igual(tk('Hola *Ana*'), [{ t: 'texto', v: 'Hola ' }, { t: 'negrita', hijos: [{ t: 'texto', v: 'Ana' }] }]), '*negrita*');
  check(igual(tk('_cursiva_ y ~tachado~'), [{ t: 'cursiva', hijos: [{ t: 'texto', v: 'cursiva' }] }, { t: 'texto', v: ' y ' }, { t: 'tachado', hijos: [{ t: 'texto', v: 'tachado' }] }]), '_cursiva_ y ~tachado~');
  check(igual(tk('usa `RIR 2` hoy'), [{ t: 'texto', v: 'usa ' }, { t: 'mono', v: 'RIR 2' }, { t: 'texto', v: ' hoy' }]) && tk('```a\n*b*```')[0].t === 'mono' && tk('```a\n*b*```')[0].v === 'a\n*b*',
    '`monoespaciado` y ```bloque``` (dentro no hay más formato)');
  check(igual(tk('*_las dos_*'), [{ t: 'negrita', hijos: [{ t: 'cursiva', hijos: [{ t: 'texto', v: 'las dos' }] }] }]), 'se anidan (*_negrita y cursiva_*)');
  check(igual(tk('2*3*4'), [{ t: 'texto', v: '2*3*4' }]) && igual(tk('mi_variable_larga'), [{ t: 'texto', v: 'mi_variable_larga' }]) && igual(tk('* suelto *'), [{ t: 'texto', v: '* suelto *' }]),
    'como WhatsApp: dentro de una palabra o con espacios junto al signo, no es formato');
  check(igual(tk('*no\ncruza*'), [{ t: 'texto', v: '*no\ncruza*' }]) && igual(tk('*sin cerrar'), [{ t: 'texto', v: '*sin cerrar' }]), 'no salta de línea; sin cerrar, es texto');
  const conUrl = tk('Mira https://youtu.be/gMgvBspQ9lk_x y _esto_');
  check(conUrl.some((x) => x.t === 'enlace' && x.v === 'https://youtu.be/gMgvBspQ9lk_x') && conUrl.some((x) => x.t === 'cursiva'), 'un «_» dentro de un enlace no abre cursiva, y el enlace sigue siendo enlace');
  const enNegrita = tk('*mira https://www.youtube.com/watch?v=gMgvBspQ9lk*');
  check(enNegrita[0].t === 'negrita' && enNegrita[0].hijos.some((x) => x.t === 'enlace' && x.youtube === 'gMgvBspQ9lk'), 'un enlace en negrita sigue siendo enlace (con su vídeo de YouTube)');
  check(igual(tk('<b>hola</b> *x*')[0], { t: 'texto', v: '<b>hola</b> ' }), 'el HTML es texto (la pantalla nunca lo interpreta)');
  check(F.textoPlano('*Hola* _Ana_, `RIR 2` ~ya~') === 'Hola Ana, RIR 2 ya' && !F.conFormato(tk('nada especial')), 'el texto sin las marcas (citas, vistas previas, búsqueda)');
  check(igual(tk(' raro *x*'), [{ t: 'texto', v: ' raro *x*' }]), 'un texto con caracteres del área privada no se confunde con un enlace');

  const ahora = Date.parse('2026-11-03T18:50:00');
  const msg = (id, autor, min, extra = {}) => ({ id, autor, texto: `m${id}`, creado_en: new Date(ahora - min * 60000).toISOString(), leido_en: null, ...extra });
  check(M.extractoCita({ texto: 'Hola *Ana*,\n\n¿qué tal?' }) === 'Hola Ana, ¿qué tal?' && M.extractoCita({ texto: 'x'.repeat(300) }).length === 160, 'la cita: en una línea, sin marcas y recortada');
  check(M.extractoCita({ texto: 'Foto', archivo_id: 'a' }) === '📷 Foto' && M.extractoCita({ texto: 'Vídeo', archivoId: 'a' }) === '🎥 Vídeo'
    && M.extractoCita({ texto: 'La rodilla', archivo: { mime: 'image/png' } }) === '📷 La rodilla' && M.extractoCita({ texto: 'x', archivo: { mime: 'application/pdf' } }) === '📄 x',
    '«📷 Foto», «🎥 Vídeo», «📄 Archivo» (con su pie, si lo tiene)');
  check(M.extractoCita({ texto: 'Se eliminó este mensaje', eliminado_en: 'x' }) === '🚫 Se eliminó este mensaje' && M.extractoCita(null) === 'Mensaje no disponible', 'eliminado o que no está');
  const lista = [msg('1', 'coach', 60, { leido_en: 'x' }), msg('2', 'atleta', 50), msg('3', 'coach', 40), msg('4', 'coach', 30, { eliminado_en: 'x' }), msg('5', 'coach', 20), msg('6', 'coach', -60, { enviar_en: new Date(ahora + 3600000).toISOString() })];
  check(igual(M.separadorNoLeidos(lista, 'atleta', ahora), { id: '3', n: 2 }) && M.textoNoLeidos(2) === '2 MENSAJES SIN LEER' && M.textoNoLeidos(1) === '1 MENSAJE SIN LEER',
    '«2 MENSAJES SIN LEER» encima del primero sin leer de la otra parte (sin contar lo eliminado ni lo programado)');
  check(M.separadorNoLeidos(lista.map((c) => ({ ...c, leido_en: 'x' })), 'atleta', ahora) === null && M.separadorNoLeidos(lista, 'coach', ahora).id === '2', 'nada sin leer, nada; y cada uno ve lo suyo');
  const bus = [{ id: 'a', texto: 'Mañana *rodilla*' }, { id: 'b', texto: 'Foto', archivo_id: 'f' }, { id: 'c', texto: 'RODILLA bien' }, { id: 'd', texto: 'rodilla', eliminado_en: 'x' }, { id: 'e', texto: 'nada' }];
  check(igual(M.coincidencias(bus, 'rodilla'), ['a', 'c']) && igual(M.coincidencias(bus, 'manana'), ['a']) && igual(M.coincidencias(bus, 'r'), []) && igual(M.coincidencias(bus, 'foto'), []),
    'buscar: sin tildes ni mayúsculas, ni lo eliminado ni las marcas de las fotos; con 2 letras como mínimo');
  check(igual(M.resaltar('La RodÍlla y la rodilla', 'rodilla'), [{ v: 'La ', marca: false }, { v: 'RodÍlla', marca: true }, { v: ' y la ', marca: false }, { v: 'rodilla', marca: true }]),
    'lo que coincide se marca con sus letras de verdad (también con tildes)');
  check(M.normalLetras('Ñandú 💪 ß').length === 'Ñandú 💪 ß'.length, 'normalizar no mueve las posiciones (emojis y letras raras)');
  const rs = M.resumenReacciones([{ usuario_id: 'yo', emoji: '💪' }, { usuario_id: 'otro', emoji: '❤️' }, { usuario_id: 'x', emoji: '💪' }, { usuario_id: 'z', emoji: '🍺' }], 'yo');
  check(igual(rs, [{ emoji: '❤️', n: 1, mia: false }, { emoji: '💪', n: 2, mia: true }, { emoji: '🍺', n: 1, mia: false }]), 'las reacciones, agrupadas en el orden de la lista (v0.56: las demás, detrás)');
  check(M.resumenReacciones([{ usuario_id: 'z', emoji: 'ok' }], 'yo').length === 0, '(y lo que no es un emoji, fuera)');
  check(M.siguienteReaccion('💪', '💪') === null && M.siguienteReaccion('💪', '❤️') === '❤️' && M.siguienteReaccion(null, '👍') === '👍', 'la misma la quita; otra la cambia');
  const mio = msg('m', 'atleta', 10);
  check(M.puedeEditar(mio, 'atleta', ahora) && !M.puedeEditar(msg('m', 'atleta', 16), 'atleta', ahora) && !M.puedeEditar(mio, 'coach', ahora)
    && !M.puedeEditar({ ...mio, archivo_id: 'a' }, 'atleta', ahora) && !M.puedeEditar({ ...mio, eliminado_en: 'x' }, 'atleta', ahora),
    'editar: lo propio, de texto, en sus 15 minutos y sin eliminar');
  check(M.puedeEliminar(msg('m', 'atleta', 47 * 60), 'atleta', ahora) && !M.puedeEliminar(msg('m', 'atleta', 49 * 60), 'atleta', ahora)
    && M.puedeEliminar(msg('p', 'coach', -600, { enviar_en: new Date(ahora + 864e5).toISOString() }), 'coach', ahora) && !M.puedeEliminar(mio, 'coach', ahora),
    'eliminar para todos: lo propio en 48 horas (el programado, siempre: se cancela)');
  check(M.cuandoInfo(new Date(ahora - 8 * 60000).toISOString(), ahora) === 'hoy 18:42' && M.cuandoInfo('2026-11-02T18:42:00', ahora) === 'ayer 18:42' && M.cuandoInfo('2026-10-26T09:05:00', ahora) === 'lun 26 oct, 9:05',
    'Info: «hoy 18:42», «ayer 18:42», «lun 26 oct, 9:05»');
  const filaInfo = (xs, k) => xs.find(([x]) => x === k) || null;
  check(igual(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', entregado_en: '2026-11-03T18:43:00', leido_en: '2026-11-03T18:50:00', editado_en: '2026-11-03T18:45:00' }, ahora), [['Enviado', 'hoy 18:42'], ['Entregado', 'hoy 18:43'], ['Leído', 'hoy 18:50'], ['Editado', 'hoy 18:45']])
    && filaInfo(M.infoMensaje({ creado_en: '2026-11-03T18:42:00' }, ahora), 'Leído')[1] === 'todavía no', 'Info de un mensaje: enviado, entregado (v0.56), leído (o todavía no) y editado');
  {
    // (v0.54, revisión) L3: con «Mostrar cuándo estoy en línea» apagado, el leído sin hora; y el que guardó la base solo con el día
    const { instanteMadrid } = await import('../web/src/logica/fechas.js');
    const soloDia = instanteMadrid('2026-11-03', '00:00');
    check(M.leidoSoloDia(soloDia) && !M.leidoSoloDia('2026-11-03T18:50:00') && !M.leidoSoloDia(null), 'un leído de medianoche de Madrid es «solo el día»');
    check(igual(filaInfo(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', leido_en: '2026-11-03T18:50:00' }, ahora, { horaLeido: false }), 'Leído'), ['Leído', 'hoy'])
      && igual(filaInfo(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', leido_en: soloDia }, ahora), 'Leído'), ['Leído', 'hoy'])
      && igual(filaInfo(M.infoMensaje({ creado_en: '2026-11-02T18:42:00', leido_en: instanteMadrid('2026-11-02', '00:00') }, ahora), 'Leído'), ['Leído', 'ayer']),
      'Info: «Leído: hoy» sin hora si yo la oculto o si la otra parte la tenía oculta');
    check(M.diaInfo('2026-11-03T08:00:00', ahora) === 'hoy' && M.diaInfo('2026-10-26T09:05:00', ahora) === 'lun 26 oct' && M.diaInfo('2025-10-26T09:05:00', ahora) === 'dom 26 oct 2025' && M.diaInfo(null) === null,
      'el día de Info: hoy, ayer o la fecha (con el año, si no es este)');
  }
  {
    // (v0.54, revisión) L1: el formato es lineal: 4000 caracteres hechos para atascarlo, en menos de 5 ms
    const casos = { 'sin cierres': '*a '.repeat(1333), anidados: '*_~'.repeat(666) + 'x' + '~_*'.repeat(666), 'aperturas en una línea': '*x'.repeat(2000),
      mezclados: '_*~`'.repeat(1000), 'con saltos': '*a\n_b '.repeat(700), comillas: '`*'.repeat(2000), triples: '```*_'.repeat(800) };
    const tiempos = {};
    for (const [k, v] of Object.entries(casos)) {
      const s = v.slice(0, 4000);
      for (let i = 0; i < 5; i++) tk(s);
      const t = [];
      for (let i = 0; i < 9; i++) { const t0 = performance.now(); tk(s); t.push(performance.now() - t0); }
      tiempos[k] = t.sort((a, b) => a - b)[4];
    }
    const lento = Object.entries(tiempos).filter(([, ms]) => ms >= 5);
    check(!lento.length, `formato lineal: 4000 caracteres patológicos en menos de 5 ms (mediana; el peor, ${Math.max(...Object.values(tiempos)).toFixed(2)} ms)${lento.length ? ' — lentos: ' + lento.map(([k, ms]) => `${k} ${ms.toFixed(1)} ms`).join(', ') : ''}`);
    const largo = '*x'.repeat(2000) + ' *fin*';
    check(tk(largo).some((x) => x.t === 'negrita'), 'y sigue encontrando lo que sí es formato al final');
    const a1 = F.tokensDeMensaje('m1', 'Hola *Ana*'), a2 = F.tokensDeMensaje('m1', 'Hola *Ana*'), a3 = F.tokensDeMensaje('m1', 'Hola _Ana_');
    check(a1 === a2 && a3 !== a1 && a3[1].t === 'cursiva' && igual(F.tokensDeMensaje(null, '*x*'), tk('*x*')), 'los tokens se guardan por mensaje y texto (si el texto cambia, se recalculan)');
  }
  check(M.textoUltimaVez('2026-11-03T18:42:00', ahora) === 'últ. vez hoy a las 18:42' && M.textoUltimaVez('2026-11-02T07:05:00', ahora) === 'últ. vez ayer a las 7:05' && M.textoUltimaVez('2026-10-30T10:00:00', ahora) === 'últ. vez el vie a las 10:00'
    && M.textoUltimaVez('2026-09-01T10:00:00', ahora) === 'últ. vez el 1 sept' && M.textoUltimaVez(null) === null, '«últ. vez hoy a las 18:42», ayer, esta semana o la fecha');
  check(M.estadoConexion({ escribiendo: true, enLinea: true }) === 'escribiendo…' && M.estadoConexion({ enLinea: true }) === 'en línea' && M.estadoConexion({}) === null, '«escribiendo…» antes que «en línea»');
  const enl = M.enlacesDe([{ id: '1', texto: 'https://a.es y https://youtu.be/gMgvBspQ9lk' }, { id: '2', texto: 'otra vez https://a.es' }, { id: '3', texto: 'https://b.es', eliminado_en: 'x' }]);
  check(igual(enl.map((x) => [x.url, x.mensajeId]), [['https://a.es', '2'], ['https://youtu.be/gMgvBspQ9lk', '1']]) && enl[1].youtube === 'gMgvBspQ9lk', 'los enlaces del chat: sin repetir, los últimos primero, sin lo eliminado');
  check(igual(M.mediosDe([{ id: '1', archivo: { id: 'f', mime: 'image/jpeg' } }, { id: '2', archivo: { id: 'v', mime: 'video/mp4' } }, { id: '3', archivo: { id: 'g' }, eliminado_en: 'x' }]).map((x) => x.tipo), ['video', 'foto']), 'las fotos y los vídeos');
  check(M.consultaRapida('/sub') === 'sub' && M.consultaRapida('/') === '' && M.consultaRapida('hola /x') === null && M.consultaRapida('/a\nb') === null, '«/» al principio abre las respuestas rápidas');
  const rap = [{ titulo: 'Sube la carga', texto: 'Muy bien {nombre}' }, { titulo: 'Técnica', texto: 'Sube despacio' }, { titulo: 'Descanso', texto: 'Hoy descansa' }];
  check(igual(M.filtrarRapidas(rap, 'sube').map((r) => r.titulo), ['Sube la carga', 'Técnica']) && M.filtrarRapidas(rap, 'tecnica')[0].titulo === 'Técnica' && M.filtrarRapidas(rap, '').length === 3,
    'filtradas al escribir (las del título primero, sin tildes)');
  const mem = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, m }; })();
  M.guardarBorrador(mem, 'u1', 'a1', 'Hola, mañana ', { respondeA: 'c9', ahora });
  check(igual(M.leerBorrador(mem, 'u1', 'a1', ahora), { texto: 'Hola, mañana ', respondeA: 'c9' }) && M.leerBorrador(mem, 'u1', 'a2', ahora) === null && M.leerBorrador(mem, 'u2', 'a1', ahora) === null,
    'el borrador, por conversación y por cuenta');
  M.guardarBorrador(mem, 'u1', 'a1', '   ', { ahora });
  check(M.leerBorrador(mem, 'u1', 'a1', ahora) === null && mem.length === 0, 'vacío, se quita');
  M.guardarBorrador(mem, 'u1', 'a1', 'viejo', { ahora: ahora - 31 * 864e5 });
  check(M.leerBorrador(mem, 'u1', 'a1', ahora) === null && mem.length === 0, 'a los 30 días caduca');
  M.guardarBorrador(mem, 'u1', 'a1', 'uno', { ahora }); M.guardarBorrador(mem, 'u1', 'a2', 'dos', { ahora }); mem.setItem('otra-cosa', '1');
  check(M.borrarBorradores(mem) === 2 && mem.length === 1, 'al cerrar la sesión se van todos (y nada más)');
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('lleno'); }, removeItem() { throw new Error('x'); }, key() { throw new Error('x'); }, length: 1 };
  check(M.leerBorrador(roto, 'u', 'a') === null && M.guardarBorrador(roto, 'u', 'a', 'x') === false && M.borrarBorradores(roto) === 0, 'sin almacenamiento (bloqueado o lleno), no rompe nada');
  check(igual(M.vistaPrevia({ autor: 'coach', texto: '*Hola*', leido_en: 'x' }), { borrador: false, texto: 'Hola', mio: true, visto: true, entregado: true, eliminado: false }) && M.vistaPrevia(null, { borrador: 'Te *escribo*' }).texto === 'Te escribo'
    && M.vistaPrevia({ autor: 'atleta', texto: 'Foto', archivo_id: 'f' }).texto === '📷 Foto', 'la vista previa de la lista: ✓✓ en lo propio, «Borrador:» y «📷 Foto»');
  const conv = (nombre, extra = {}) => ({ atleta: { id: nombre, nombre }, ultimo: { creado_en: extra.t || '2026-11-01' }, sinLeer: 0, estado: null, ...extra });
  const orden = M.ordenarConversaciones([conv('Ana', { t: '2026-11-03' }), conv('Bea', { estado: { fijada_en: '2026-11-01T10:00' } }), conv('Car', { sinLeer: 2 }), conv('Dan', { estado: { fijada_en: '2026-11-02T10:00' } }), conv('Eva', { estado: { no_leida: true } })]);
  check(igual(orden.map((x) => x.atleta.nombre), ['Dan', 'Bea', 'Car', 'Eva', 'Ana']), 'la lista: las fijadas arriba (la última fijada primero), después lo sin leer (o «no leída») y lo más reciente');
  const filas = [conv('A', { sinLeer: 1 }), conv('B', { estado: { fijada_en: 'x' } }), conv('C', { estado: { archivada_en: 'x' } }), conv('D', { estado: { no_leida: true } })];
  check(igual(M.filtrarConversaciones(filas).map((x) => x.atleta.nombre), ['A', 'B', 'D']) && igual(M.filtrarConversaciones(filas, 'no-leidos').map((x) => x.atleta.nombre), ['A', 'D'])
    && igual(M.filtrarConversaciones(filas, 'fijados').map((x) => x.atleta.nombre), ['B']) && igual(M.filtrarConversaciones(filas, 'todos', { archivadas: true }).map((x) => x.atleta.nombre), ['C']),
    'filtros «Todos / No leídos / Fijados» (sin las archivadas, que van aparte)');
}
console.log('\nv0.55: el chat, aún más como WhatsApp');
{
  const C = await import('../web/src/logica/chat.js');
  const E = await import('../web/src/logica/emojis.js');
  const M = await import('../web/src/logica/mensajes.js');
  const { crearSalida } = await import('../web/src/datos/salida.js');
  // Emojis solos (1 a 3, en grande)
  check(C.soloEmojis('👍') === 1 && C.soloEmojis('💪💪') === 2 && C.soloEmojis(' 🔥 💯 🏋️ ') === 3 && C.soloEmojis('😂😂😂😂') === 0, '1 a 3 emojis solos van en grande; 4, no');
  check(C.soloEmojis('hola 👍') === 0 && C.soloEmojis('👍!') === 0 && C.soloEmojis('123') === 0 && C.soloEmojis('') === 0 && C.soloEmojis('   ') === 0 && C.soloEmojis('#') === 0, 'con texto, signos o números, no');
  check(C.cuantosEmojis('👍🏽') === 1 && C.cuantosEmojis('👩‍💻') === 1 && C.cuantosEmojis('🇪🇸') === 1 && C.cuantosEmojis('1️⃣') === 1 && C.cuantosEmojis('❤️‍🔥') === 1 && C.cuantosEmojis('🏃‍♀️💨') === 2,
    'un emoji con su tono, unido con ZWJ, una bandera o un número en su tecla cuenta como uno');
  check(E.TODOS_EMOJIS.length >= 300 && new Set(E.TODOS_EMOJIS).size === E.TODOS_EMOJIS.length && E.TODOS_EMOJIS.every((e) => C.cuantosEmojis(e) === 1) && E.CATEGORIAS_EMOJI.length >= 6,
    `el selector: ${E.TODOS_EMOJIS.length} emojis propios, por categorías, sin repetir, y cada uno es un emoji entero`);
  const memE = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  for (const e of ['👍', '💪', '🔥', '👍']) E.apuntarReciente(memE, e);
  check(igual(E.leerRecientes(memE), ['👍', '🔥', '💪']), 'los recientes: el último primero, sin repetir');
  for (let i = 0; i < 40; i++) E.apuntarReciente(memE, E.TODOS_EMOJIS[i]);
  memE.setItem(E.CLAVE_RECIENTES, JSON.stringify([...JSON.parse(memE.getItem(E.CLAVE_RECIENTES)), '<script>', 7]));
  check(E.leerRecientes(memE).length === 24 && E.leerRecientes(memE).every((e) => E.TODOS_EMOJIS.includes(e)), 'como mucho 24, y solo emojis de la lista (lo raro del almacenamiento no entra)');
  check(E.leerRecientes({ getItem() { throw new Error('x'); } }).length === 0 && E.apuntarReciente({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }, '👍')[0] === '👍', 'sin almacenamiento, no rompe');
  check(igual(E.insertarEnTexto('Hola !', '👋', 5, 5), { texto: 'Hola 👋!', cursor: 7 }) && E.insertarEnTexto('abc', '🔥').texto === 'abc🔥' && E.insertarEnTexto('abcdef', '🔥', 1, 4).texto === 'a🔥ef',
    'el emoji va donde está el cursor (o sustituye lo seleccionado)');
  // Mensajes largos
  const largo = Array.from({ length: 200 }, (_, i) => `palabra${i}`).join(' ');
  const r = C.recortarLargo(largo);
  check(r.cortado && r.texto.endsWith('…') && [...r.texto].length <= 702 && !/palabra\d*…$/.test(r.texto.replace(/ …$/, '')) || (r.cortado && / palabra\d+…$/.test(r.texto)), 'un mensaje de más de ~700 letras se corta con «Leer más» (en un espacio, sin partir una palabra)');
  check(!C.recortarLargo('hola').cortado && !C.recortarLargo('x'.repeat(760)).cortado && C.recortarLargo('😀'.repeat(900)).texto.endsWith('😀…'), 'los cortos no (ni los que se pasan poco); un emoji no se parte por la mitad');
  // La píldora del día
  const ahora = new Date(2026, 10, 3, 18, 0).getTime();
  const dia = (d, h = 10) => new Date(2026, 10, d, h).toISOString();
  check(C.etiquetaDia(dia(3), ahora) === 'Hoy' && C.etiquetaDia(dia(2, 23), ahora) === 'Ayer' && C.etiquetaDia(dia(28 - 30 + 30 - 2 + 3, 9), ahora) !== '' && C.etiquetaDia(new Date(2026, 9, 31, 12).toISOString(), ahora) === 'sábado',
    'la píldora: «Hoy», «Ayer» y el día de la semana en la última semana («sábado»)');
  check(C.etiquetaDia(new Date(2026, 9, 12, 12).toISOString(), ahora) === '12 de octubre' && C.etiquetaDia(new Date(2025, 11, 24, 12).toISOString(), ahora) === '24 de diciembre de 2025' && C.etiquetaDia(null) === '' && C.etiquetaDia('no') === '',
    'más atrás, «12 de octubre» (y el año si no es este)');
  // Los ✓
  const e = (c) => C.estadoEnvio({ autor: 'atleta', creado_en: 'x', ...c }, 'atleta');
  check(e({ pendiente: true }) === 'pendiente' && e({ fallo: true }) === 'fallo' && e({}) === 'enviado' && e({ entregado_en: 'x' }) === 'entregado' && e({ entregado_en: 'x', leido_en: 'y' }) === 'leido' && e({ leido_en: 'y' }) === 'leido',
    '⏱ al salir, ✓ en la base, ✓✓ gris al llegarle, ✓✓ azul al leerlo (y «!» si falló)');
  check(C.estadoEnvio({ autor: 'coach' }, 'atleta') === null && C.estadoEnvio({ autor: 'coach', programado: true }, 'coach') === null && C.estadoEnvio({ autor: 'coach', eliminado_en: 'x' }, 'coach') === null, 'nada en lo del otro, en lo programado ni en lo eliminado');
  // La bandeja de salida: orden y sin duplicados
  const p1 = C.nuevoPendiente({ perfil: 'u', atletaId: 'a', autor: 'atleta', texto: '  uno  ', ahora: 1000, id: 'c1' });
  const p2 = C.nuevoPendiente({ perfil: 'u', atletaId: 'a', autor: 'atleta', texto: 'dos', ahora: 2000, id: 'c2' });
  const p3 = C.nuevoPendiente({ perfil: 'otro', atletaId: 'a', autor: 'atleta', texto: 'ajeno', ahora: 500, id: 'c3' });
  check(p1.texto === 'uno' && p1.estado === 'pendiente' && p1.cliente_id === 'c1' && /^[0-9a-f-]{36}$/.test(C.nuevoPendiente({ perfil: 'u', atletaId: 'a', autor: 'atleta', texto: 'x' }).cliente_id), 'cada mensaje sale con su id (el mismo al reintentar)');
  check(igual(C.ordenarSalida([p2, p1, p1, p3]).map((x) => x.cliente_id), ['c3', 'c1', 'c2']), 'en orden de creación y sin repetir');
  check(C.siguienteSalida([p2, { ...p1, estado: 'fallo' }, p3], 'u').cliente_id === 'c2' && C.siguienteSalida([p3], 'u') === null, 'el siguiente: de esta cuenta y sin los fallidos (esperan a que se reintenten)');
  check(igual(C.quitarYaEnviados([p1, p2], [{ cliente_id: 'c1' }]).map((x) => x.cliente_id), ['c2']), 'lo que ya está en la base sale de la bandeja');
  const vistaC = C.conPendientes([{ id: 's1', cliente_id: 'c1', texto: 'uno' }], [p1, p2, p3, { ...C.nuevoPendiente({ perfil: 'u', atletaId: 'b', autor: 'atleta', texto: 'otro chat', id: 'c4' }) }, { ...p2, cliente_id: 'c5', estado: 'fallo', error: 'No' }, { ...p2, cliente_id: 'c6', estado: 'enviado' }], { perfil: 'u', atletaId: 'a' });
  check(igual(vistaC.map((x) => x.id), ['s1', 'pendiente-c2', 'pendiente-c5', 'pendiente-c6']) && vistaC[1].pendiente && !vistaC[1].fallo && vistaC[2].fallo && !vistaC[3].pendiente && !vistaC[3].fallo,
    'en el chat, lo que sale va al final (⏱, «!» o ya con ✓), sin repetir lo que ya llegó ni lo de otros chats o cuentas');
  const conProg = C.conPendientes([{ id: 's1', creado_en: 'a' }, { id: 'p1', programado: true, enviar_en: new Date(Date.now() + 864e5).toISOString() }], [p2], { perfil: 'u', atletaId: 'a' });
  check(igual(conProg.map((x) => x.id), ['s1', 'pendiente-c2', 'p1']), '(antes de los programados del coach, que van al final con su hora)');
  // La bandeja de verdad (con una base de mentira): en orden, sin cobertura espera, lo rechazado se queda con «!»
  const memS = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  const enviados = [];
  let sinRed = false;
  const apiFalsa = { uid: () => 'u', async enviarMensaje(atletaId, { texto, clienteId }) {
    if (sinRed) { const err = new Error('Sin conexión.'); err.sinConexion = true; throw err; }
    if (texto === 'rechazado') throw new Error('Tu cuenta está de baja');
    if (enviados.some((x) => x.clienteId === clienteId)) throw new Error('duplicado');
    enviados.push({ atletaId, texto, clienteId });
    return { id: `s-${clienteId}` };
  } };
  const sal = crearSalida(apiFalsa, { almacen: memS, reintentoMs: 60000 });
  sinRed = true;
  sal.encolar({ atletaId: 'a', autor: 'atleta', texto: 'primero' });
  sal.encolar({ atletaId: 'a', autor: 'atleta', texto: 'segundo' });
  await new Promise((r) => setTimeout(r, 20));
  check(sal.pendientes('a').length === 2 && sal.pendientes('a').every((x) => x.estado === 'pendiente') && !enviados.length, 'sin cobertura, se quedan en la bandeja (y con ⏱)');
  const recargada = crearSalida(apiFalsa, { almacen: memS, reintentoMs: 60000 });
  check(recargada.pendientes('a').map((x) => x.texto).join() === 'primero,segundo', 'y se guardan en el móvil (al volver a abrir la app siguen ahí, en orden)');
  sinRed = false;
  await recargada.vaciar();
  check(enviados.map((x) => x.texto).join() === 'primero,segundo' && !recargada.pendientes('a').length, 'al volver la cobertura, salen solos y en orden');
  await recargada.vaciar();
  check(enviados.length === 2, 'sin repetir ninguno');
  recargada.encolar({ atletaId: 'a', autor: 'atleta', texto: 'rechazado' });
  await new Promise((r) => setTimeout(r, 20));
  const f = recargada.pendientes('a')[0];
  check(f?.estado === 'fallo' && /baja/.test(f.error), 'si la base lo rechaza, se queda con «!» (y por qué)');
  recargada.descartar(f.cliente_id);
  check(!recargada.pendientes('a').length, '«Eliminar» lo quita de la bandeja');
  // (revisión) La app se cierra (o se mata) a media subida: lo que estaba «enviando» vuelve a pendiente al abrirla y sale
  // (sin repetirse: la base no deja entrar dos con el mismo cliente_id)
  check(igual(C.retomarSalida([{ cliente_id: 'k1', creado_en: 'b', estado: 'enviando' }, { cliente_id: 'k0', creado_en: 'a', estado: 'fallo' }, { cliente_id: 'k1', creado_en: 'b', estado: 'pendiente' }]).map((x) => [x.cliente_id, x.estado]), [['k0', 'fallo'], ['k1', 'pendiente']]),
    '(revisión) al abrir: «enviando» vuelve a pendiente (los «!» siguen esperando a que los reintentes), en orden y sin repetir');
  const memK = new Map(); const almK = { getItem: (k) => memK.get(k) ?? null, setItem: (k, v) => memK.set(k, String(v)), removeItem: (k) => memK.delete(k) };
  const atascado = C.nuevoPendiente({ perfil: 'u', atletaId: 'a', autor: 'atleta', texto: 'a medias', id: 'k-atascado' });
  almK.setItem('fbe-salida-v1', JSON.stringify([{ ...atascado, estado: 'enviando', intentos: 1 }]));
  const enviadosK = [];
  const salK = crearSalida({ uid: () => 'u', async enviarMensaje(atletaId, { texto, clienteId }) { enviadosK.push(clienteId); return { id: 's', cliente_id: clienteId }; } }, { almacen: almK, reintentoMs: 60000 });
  check(salK.pendientes('a')[0]?.estado === 'pendiente', '(revisión) tras matar la app a media subida, el mensaje no se queda con ⏱ para siempre');
  await salK.vaciar();
  check(igual(enviadosK, ['k-atascado']) && !salK.pendientes('a').length, '(revisión) y sale solo, con su mismo cliente_id');
  // Lo que ya está en la conversación de la base (llegó, pero la respuesta se perdió) sale de la bandeja: también un «!»
  almK.setItem('fbe-salida-v1', JSON.stringify([{ ...atascado, cliente_id: 'k-llego', estado: 'fallo', error: 'x' }, { ...atascado, cliente_id: 'k-no', estado: 'fallo', error: 'x' }]));
  const salK2 = crearSalida({ uid: () => 'u', async enviarMensaje() { throw new Error('no'); } }, { almacen: almK, reintentoMs: 60000 });
  let avisosK = 0; salK2.oir(() => { avisosK++; });
  salK2.confirmar([{ id: 'm1', cliente_id: 'k-llego' }, { id: 'm2', cliente_id: null }]);
  check(igual(salK2.pendientes('a').map((x) => x.cliente_id), ['k-no']) && avisosK === 1 && JSON.parse(memK.get('fbe-salida-v1')).length === 1,
    '(revisión) con la conversación delante, lo que ya está en la base sale de la bandeja (y del móvil)');
  salK2.confirmar([{ id: 'm1', cliente_id: 'k-llego' }]);
  check(avisosK === 1, '(y si no cambia nada, no avisa)');
  recargada.borrarTodo();
  check(memS.getItem('fbe-salida-v1') === null, 'al cerrar sesión no queda nada en el móvil');
  // Reenviar y difundir
  const atl = [{ id: 'a', estado: 'activo' }, { id: 'b', estado: 'baja' }, { id: 'c', estado: 'pausado' }];
  check(igual(C.planDifusion([{ atleta_id: 'a' }, { atleta_id: 'b' }, { atleta_id: 'c' }, { atleta_id: 'a' }, { atleta_id: 'zz' }], atl), { destinos: ['a', 'c'], saltados: 1 }), 'difundir: a cada miembro una vez; los de baja se saltan (y se cuentan)');
  check(igual(C.planReenvio(['a', 'b', 'a', 'x'], atl), { destinos: ['a'], saltados: 1, demasiados: false }) && C.planReenvio(Array.from({ length: 51 }, (_, i) => `z${i}`), Array.from({ length: 51 }, (_, i) => ({ id: `z${i}`, estado: 'activo' }))).demasiados,
    'reenviar: sin repetir, sin los de baja, y como mucho 50');
  check(C.textoSaltados(1) === '1 de baja: no le llega' && C.textoSaltados(3) === '3 de baja: no les llega' && C.textoSaltados(0) === '', 'y dice cuántos se saltan');
  const mC = { id: 'm', autor: 'coach', creado_en: new Date().toISOString(), texto: 'x' };
  check(C.reenviable(mC, 'coach') && !C.reenviable(mC, 'atleta') && !C.reenviable({ ...mC, autor: 'atleta' }, 'coach') && !C.reenviable({ ...mC, eliminado_en: 'x' }, 'coach')
    && !C.reenviable({ ...mC, enviar_en: new Date(Date.now() + 864e5).toISOString() }, 'coach') && !C.reenviable({ ...mC, sesion_id: 's' }, 'coach') && !C.reenviable({ ...mC, archivo_id: 'v', adjunto: false }, 'coach')
    && C.reenviable({ ...mC, archivo_id: 'f', adjunto: true }, 'coach') && !C.reenviable({ ...mC, pendiente: true }, 'coach'),
    'se reenvía lo del coach, del chat y ya salido (lo de un atleta, no: son datos de salud de otra persona)');
  check(!C.reenviable({ ...mC, encuesta: { id: 'e1', opciones: ['a', 'b'] } }, 'coach') && !C.reenviable({ ...mC, subida: { estado: 'subiendo' } }, 'coach'), '(revisión) una encuesta no se reenvía (ni lo que aún se está subiendo)');
  check(!C.reenviable({ ...mC, archivo_id: 'f', adjunto: true, fotograma: true }, 'coach') && !C.accionesSeleccion([{ ...mC, archivo_id: 'f', adjunto: true, fotograma: true }], 'coach').reenviar,
    '(v0.57, revisión de seguridad) el fotograma del vídeo de un atleta no se reenvía (es solo suyo)');
  // PDF
  check(C.nombreSeguroPdf('../../etc/passwd') === 'passwd.pdf' && C.nombreSeguroPdf('C:\\Users\\Ana\\Plan.PDF') === 'Plan.pdf' && C.nombreSeguroPdf('') === 'documento.pdf' && C.nombreSeguroPdf('...pdf') === 'pdf.pdf',
    'el nombre de un PDF: sin carpetas (ni «../»), siempre .pdf y, si no queda nada, «documento.pdf»');
  check(C.nombreSeguroPdf('plan\u0000\u0007\u202e fdp.exe.pdf') === 'plan fdp.exe.pdf' && C.nombreSeguroPdf('a..b..pdf') === 'a.b.pdf' && !C.nombreSeguroPdf('a<b>:"|?*.pdf').match(/[<>:"|?*]/)
    && [...C.nombreSeguroPdf('x'.repeat(300))].length === 120 && C.nombreSeguroPdf('  .oculto.pdf') === 'oculto.pdf', 'sin caracteres de control ni invisibles (ni el que da la vuelta al texto), sin «..», hasta 120 letras');
  check(C.nombreSeguroPdf('informe. .pdf') === 'informe.pdf' && C.nombreSeguroPdf('informe..PDF') === 'informe.pdf' && C.nombreSeguroPdf('. . .pdf') === 'pdf.pdf' && C.nombreSeguroPdf('. . ..pdf.') === 'pdf.pdf' && C.nombreSeguroPdf(`${'x'.repeat(115)}.yy.pdf`).includes('..') === false,
    '(revisión) sin punto ni espacio antes de «.pdf» (no queda «..», que la base no acepta)');
  // Lo mismo que pide la base (033): el nombre saneado cumple siempre sus reglas
  const REGLA_BD = new RegExp('[/\\\\\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff<>:"|?*]');
  const raros = ['a\u200b.pdf', '\ufeffb.pdf', 'c\u2066d\u2069.pdf', 'e"f".pdf', 'g\u0085h.pdf', ' . i', 'j\\k/l.pdf', 'm'.repeat(400), '...', 'n. .', 'o\u202e.exe'];
  check(raros.every((x) => { const nm = C.nombreSeguroPdf(x); return /\.pdf$/i.test(nm) && !REGLA_BD.test(nm) && !nm.includes('..') && !/^[.\s]/.test(nm) && [...nm].length <= 120 && nm.trim().length > 4; }),
    '(revisión) cualquier nombre, ya saneado, pasa las reglas de la base');
  const bytes = (t) => new TextEncoder().encode(t);
  check(C.esPdf(bytes('%PDF-1.7\n')) && C.esPdf(bytes('\n\n  %PDF-1.4')) && !C.esPdf(bytes('<html>%PDF')) && !C.esPdf(bytes('GIF89a')) && !C.esPdf(new Uint8Array()) && !C.esPdf(bytes(`${'x'.repeat(1100)}%PDF-`)),
    'es un PDF si lleva su firma («%PDF-») al principio (en los primeros 1024 bytes)');
  check(C.paginasPdf('<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 12 >>') === 12 && C.paginasPdf('<< /Count 3 /Type /Pages >>') === 3 && C.paginasPdf('/Type /Page /Type /Page /Type /Pages') === 2 && C.paginasPdf('nada') === null,
    'las páginas, si salen fácil (si no, nada)');
  check(C.tamanoTexto(500) === '500 B' && C.tamanoTexto(2048) === '2 KB' && C.tamanoTexto(1572864) === '1,5 MB' && C.textoPaginas(1) === '1 página' && C.textoPaginas(3) === '3 páginas' && C.textoPaginas(null) === '', 'lo que pesa y sus páginas');
  check(M.medioDe({ archivo: { tipo: 'documento', mime: 'application/pdf' } }) === 'documento' && M.esMarcador({ archivo_id: 'x', texto: 'Documento' }) && M.extractoCita({ archivo: { tipo: 'documento' }, archivo_id: 'x', texto: 'Documento' }) === '📄 Documento'
    && M.extractoCita({ archivo: { tipo: 'documento' }, archivo_id: 'x', texto: 'Tu plan' }) === '📄 Tu plan', 'un PDF en la cita y en la lista: «📄 Documento» (o su pie)');
  // Silenciar y fijar
  check(Date.parse(C.hastaSilencio('8h', ahora)) === ahora + 8 * 3600000 && Date.parse(C.hastaSilencio('semana', ahora)) === ahora + 7 * 864e5 && C.hastaSilencio('siempre', ahora) === null, 'silenciar: 8 horas, 1 semana o siempre');
  let malSil = false; try { C.hastaSilencio('un año'); } catch { malSil = true; }
  check(malSil, 'otra cosa, no');
  check(C.silenciado({ hasta: null }, ahora) && C.silenciado({ hasta: new Date(ahora + 1000).toISOString() }, ahora) && !C.silenciado({ hasta: new Date(ahora - 1000).toISOString() }, ahora) && !C.silenciado(null, ahora),
    'silenciado mientras dura (siempre, o hasta su hora)');
  check(C.textoSilencio({ hasta: null }, ahora) === 'Silenciado siempre' && C.textoSilencio({ hasta: new Date(2026, 10, 3, 23, 5).toISOString() }, ahora) === 'Silenciado hasta las 23:05'
    && C.textoSilencio({ hasta: new Date(2026, 10, 10, 9, 0).toISOString() }, ahora) === 'Silenciado hasta el 10 de noviembre' && C.textoSilencio(null, ahora) === null, 'y lo dice («hasta las 23:05», «hasta el 10 de noviembre»)');
  check(Date.parse(C.hastaFijado('24h', ahora)) === ahora + 864e5 && Date.parse(C.hastaFijado('30d', ahora)) === ahora + 30 * 864e5 && C.fijadoVigente({ comentario_id: 'x', hasta: null }, ahora) && !C.fijadoVigente({ comentario_id: 'x', hasta: new Date(ahora - 1).toISOString() }, ahora),
    'fijar: 24 horas, 7 días o 30 días; caducado, ya no sale');
  // Seleccionar varios: copiar como WhatsApp y qué se puede hacer
  const sel = [
    { id: '2', autor: 'atleta', texto: 'Vale, *mañana*', creado_en: new Date(2026, 9, 12, 18, 43).toISOString() },
    { id: '1', autor: 'coach', texto: 'Hoy pierna', creado_en: new Date(2026, 9, 12, 18, 42).toISOString() },
    { id: '3', autor: 'coach', texto: 'x', eliminado_en: 'y', creado_en: new Date(2026, 9, 12, 18, 44).toISOString() },
  ];
  check(C.textoCopiado(sel, (a) => (a === 'coach' ? 'Tú' : 'Ana')) === '[12/10/26, 18:42] Tú: Hoy pierna\n[12/10/26, 18:43] Ana: Vale, mañana', 'copiar varios: «[12/10/26, 18:42] Ana: …», en orden y sin lo eliminado ni las marcas');
  const reciente = (c) => ({ creado_en: new Date().toISOString(), ...c });
  const ac1 = C.accionesSeleccion([reciente({ autor: 'coach' }), reciente({ autor: 'atleta' })], 'coach');
  check(!ac1.eliminar.ok && /tus mensajes/.test(ac1.eliminar.motivo) && ac1.copiar && !ac1.reenviar, 'con algo de la otra parte: «Eliminar para todos», no (y dice por qué); reenviar, tampoco');
  const ac2 = C.accionesSeleccion([reciente({ id: 'a', autor: 'coach' }), { id: 'b', autor: 'coach', creado_en: new Date(Date.now() - 49 * 3600000).toISOString() }], 'coach');
  check(!ac2.eliminar.ok && /48 horas/.test(ac2.eliminar.motivo), 'ni si alguno tiene más de 48 horas');
  const ac3 = C.accionesSeleccion([reciente({ id: 'a', autor: 'coach' }), reciente({ id: 'b', autor: 'coach' })], 'coach');
  check(ac3.eliminar.ok && ac3.reenviar && ac3.destacar && !C.accionesSeleccion([reciente({ id: 'a', autor: 'atleta' })], 'atleta').reenviar, 'todo lo tuyo y reciente: eliminar y reenviar (el coach; el atleta no reenvía)');
  // El aviso del móvil: los mensajes de una conversación, juntos («3 mensajes nuevos de Ana»)
  const sw = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const fuente = sw.slice(sw.indexOf('function agruparChat'), sw.indexOf('\n}\n', sw.indexOf('function agruparChat')) + 2);
  const agruparChat = new Function(`${fuente}; return agruparChat;`)();
  const a1 = agruparChat({ id: 'n1', titulo: 'Ana te ha escrito', cuerpo: 'Mensaje nuevo', url: '#mensajes/x' }, '#mensajes/x', []);
  const a2 = agruparChat({ id: 'n2', titulo: 'Ana te ha escrito', cuerpo: 'Mensaje nuevo' }, '#mensajes/x', [{ tag: 'chat:#mensajes/x', data: { n: 2 } }]);
  const a3 = agruparChat({ id: 'n3', titulo: 'Aviso de Pelayo', cuerpo: 'Tócalo para leerlo en la app.', etiqueta: 'n3' }, '#hoy', []);
  check(a1.tag === 'chat:#mensajes/x' && a1.n === 1 && a1.cuerpo === 'Mensaje nuevo' && a2.tag === a1.tag && a2.cuerpo === '3 mensajes nuevos de Ana' && a2.renotify && a3.tag === 'n3' && a3.cuerpo.startsWith('Tócalo'),
    'en el móvil, los de una conversación se juntan en una («3 mensajes nuevos de Ana»); lo demás, como siempre');
  check(!/texto|cuerpo: d\.texto/.test(fuente) && /mensajes nuevos/.test(fuente), '(sin el texto de los mensajes: solo cuántos y de quién)');
}

console.log('\nv0.56: notas de voz, encuestas, fotos, la copia del chat en el móvil y más');
{
  const V = await import('../web/src/logica/notasVoz.js');
  check(V.textoContador(42.7) === '0:42 / 1:00' && V.textoContador(75) === '1:00 / 1:00' && V.textoContador(0) === '0:00 / 1:00', 'notas de voz: «0:42 / 1:00» (y nunca más de 1:00)');
  check(!V.quedaPoco(49.9) && V.quedaPoco(50) && V.quedaPoco(59.9) && !V.quedaPoco(60) && V.segundosRestantes(52.2) === 8, 'avisa en los últimos 10 segundos («Quedan 8 s»)');
  check(!V.alLimite(59.99) && V.alLimite(60) && V.alLimite(61), 'al minuto se para sola');
  check(V.duracionGuardada(0.3) === 1 && V.duracionGuardada(42.6) === 43 && V.duracionGuardada(64) === 60 && V.duracionGuardada(NaN) === 1, 'la duración que se guarda: de 1 a 60 segundos enteros (la base acepta hasta 61)');
  check(V.formatoGrabacion((t) => t === 'audio/webm;codecs=opus')?.tipo === 'audio/webm' && V.formatoGrabacion((t) => t === 'audio/mp4')?.ext === 'm4a'
    && V.formatoGrabacion(() => false) === null && V.formatoGrabacion(null) === null, 'el formato: Opus en WebM (Chrome, Android) o MP4/AAC (iPhone); si no hay, no se graba');
  check(V.tipoAudio('audio/webm;codecs=opus').tipo === 'audio/webm' && V.tipoAudio('audio/x-m4a').tipo === 'audio/mp4' && V.tipoAudio('video/webm') === null && V.tipoAudio('audio/wav') === null,
    'el audio se sube con su tipo sin parámetros (como lo acepta Storage), y solo los de la lista');
  const onda = V.ondaDe([0, 0.1, 0.5, 0.2, 0, 0.9, 0.3, 0.1, 0, 0.4], 8);
  check(onda.length === 8 && Math.max(...onda) === 100 && onda.every((x) => Number.isInteger(x) && x >= 0 && x <= 100) && V.ondaValida(onda) && V.ondaDe([], 4).length === 8 && !V.ondaValida([1, 2]) && !V.ondaValida(Array(8).fill(101)),
    'la forma de onda: de 8 a 64 barras de 0 a 100 (lo más alto, al 100)');
  check(V.gestoVoz(-130, 0) === 'cancelar' && V.gestoVoz(0, -90) === 'bloquear' && V.gestoVoz(-20, -20) === null && V.gestoVoz(-120, -100) === 'cancelar', 'deslizar a la izquierda cancela; hacia arriba, sigue grabando sin el dedo');
  check(V.siguienteVelocidad(1) === 1.5 && V.siguienteVelocidad(1.5) === 2 && V.siguienteVelocidad(2) === 1 && V.textoVelocidad(1.5) === '1,5×', '1× → 1,5× → 2×');
  check(/permiso/.test(V.errorMicro({ name: 'NotAllowedError' })) && /ningún micro/.test(V.errorMicro({ name: 'NotFoundError' })) && /navegador/.test(V.errorMicro({ name: 'NoSoportado' })) && /otra app/.test(V.errorMicro({ name: 'NotReadableError' })),
    'permiso denegado, sin micro, micro ocupado o sin grabación: cada uno con su mensaje claro');
  const nv = readFileSync(new URL('../web/src/ui/chat/NotaVoz.jsx', import.meta.url), 'utf8');
  check(/getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(nv) && /onstop = \(\) => \{\s*soltarMicro\(\)/.test(nv), 'el micro se suelta en cuanto se para la grabación (sin el indicador encendido)');

  const E = await import('../web/src/logica/encuestas.js');
  check(E.opcionesEncuesta(['  Sí ', 'No']).ok && igual(E.opcionesEncuesta(['  Sí ', 'No']).opciones, ['Sí', 'No']) && !E.opcionesEncuesta(['Solo una']).ok && !E.opcionesEncuesta(Array.from({ length: 13 }, (_, i) => `o${i}`)).ok
    && !E.opcionesEncuesta(['Sí', 'sí']).ok && !E.opcionesEncuesta(['a'.repeat(101), 'b']).ok && !E.opcionesEncuesta(['​', 'b']).ok && !E.opcionesEncuesta('x').ok,
    'encuestas: de 2 a 12 opciones de hasta 100 letras, visibles y sin repetir (como la base)');
  const enc = E.limpiarEncuesta({ pregunta: ' ¿Qué día? ', opciones: ['Lunes', '', 'Martes'], multiple: 1 });
  check(enc.ok && enc.pregunta === '¿Qué día?' && igual(enc.opciones, ['Lunes', 'Martes']) && enc.multiple === true && !E.limpiarEncuesta({ pregunta: '', opciones: ['a', 'b'] }).ok, 'la encuesta lista: sin las opciones vacías del formulario');
  check(igual(E.alternarVoto([], 1), [1]) && igual(E.alternarVoto([1], 1), []) && igual(E.alternarVoto([1], 2), [2]) && igual(E.alternarVoto([2], 0, true), [0, 2]) && igual(E.alternarVoto([0, 2], 2, true), [0]),
    'votar: tocar elige, tocar otra cambia, tocar la tuya quita (con varias, añade o quita)');
  const res = E.resultadoEncuesta({ opciones: ['a', 'b', 'c'] }, [1]);
  check(res.votado && res.total === 1 && res.filas[1].elegida && !res.filas[0].elegida && !E.resultadoEncuesta({ opciones: ['a', 'b'] }, null).votado, 'el resultado (en una conversación vota una persona)');

  const I = await import('../web/src/logica/imagen.js');
  check(igual(I.medidaReducida(4032, 3024), { ancho: 1600, alto: 1200 }) && igual(I.medidaReducida(3024, 4032, I.LADO_HD), { ancho: 1920, alto: 2560 }) && igual(I.medidaReducida(800, 600), { ancho: 800, alto: 600 }),
    'fotos: el lado largo, 1600 px (HD, 2560); nunca se agranda');
  check(I.opcionesFoto(false).calidad === 0.8 && I.opcionesFoto(true).lado === 2560 && I.comprimible('image/jpeg') && I.comprimible('image/heic') && !I.comprimible('image/gif') && !I.comprimible('video/mp4'),
    'se vuelven a codificar las fotos (también una HEIC si el navegador sabe abrirla); un GIF, no');
  check(I.nombreJpg('IMG_2041.HEIC') === 'IMG_2041.jpg' && I.nombreJpg('') === 'foto.jpg' && I.quedarseConNueva({ bytesNueva: 50 }) && !I.quedarseConNueva({ bytesNueva: 0 }) && !I.quedarseConNueva({ bytesNueva: 300 * 1048576 }),
    '(revisión) siempre la copia vuelta a codificar (así se va el EXIF, también el GPS), aunque pese más, dentro del límite');
  // (revisión) Si no se puede volver a codificar, a una JPEG se le quitan a mano los bloques APP1 (EXIF/XMP) y APP13 (IPTC)
  const seg = (m, datos) => [0xFF, m, ((datos.length + 2) >> 8) & 255, (datos.length + 2) & 255, ...datos];
  const gps = [...new TextEncoder().encode('Exif\0\0GPS 43.36N 5.84W')];
  const jpg = new Uint8Array([0xFF, 0xD8, ...seg(0xE0, [...new TextEncoder().encode('JFIF\0'), 1, 2]), ...seg(0xE1, gps), ...seg(0xED, [...new TextEncoder().encode('Photoshop 3.0\0')]), ...seg(0xE2, [7, 7]),
    ...seg(0xFE, [...new TextEncoder().encode('comentario')]), ...seg(0xDB, [0, 1, 2]), 0xFF, 0xDA, 0, 4, 1, 2, 0x11, 0x22, 0xFF, 0x00, 0x33, 0xFF, 0xD9]);
  const limpia = I.quitarMetadatosJpeg(jpg);
  const txt = (b) => new TextDecoder('latin1').decode(b);
  check(I.esJpeg('image/jpeg') && !I.esJpeg('image/heic') && I.jpegConMetadatos(jpg) && limpia && !I.jpegConMetadatos(limpia) && !txt(limpia).includes('GPS') && !txt(limpia).includes('Photoshop') && !txt(limpia).includes('comentario')
    && txt(limpia).includes('JFIF') && limpia.length === jpg.length - (gps.length + 4) - 18 - 14 && limpia.at(-1) === 0xD9 && limpia.at(-2) === 0xFF,
    '(revisión) una JPEG sin volver a codificar: fuera EXIF, GPS, XMP, IPTC y comentarios; la imagen (y el JFIF y el perfil de color), igual');
  check(I.quitarMetadatosJpeg(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, 0, 200, 1])) === null && I.quitarMetadatosJpeg(new Uint8Array([0x89, 0x50, 0x4E, 0x47])) === null,
    '(revisión) una JPEG rota (o una PNG o HEIC) no se «limpia» a medias: null, y la app avisa antes de enviarla');
  const fotosSrc = readFileSync(new URL('../web/src/ui/fotos.js', import.meta.url), 'utf8');
  const chatSrc56 = readFileSync(new URL('../web/src/ui/Chat.jsx', import.meta.url), 'utf8');
  check(/limpia: false/.test(fotosSrc) && /quitarMetadatosJpeg/.test(fotosSrc) && chatSrc56.includes('Esta foto no se ha podido limpiar') && chatSrc56.includes('Enviar igualmente') && /Quitar \{/.test(chatSrc56),
    '(revisión) la foto que no se ha podido limpiar (HEIC) avisa antes de salir: «Enviar igualmente» o «Quitar»');
  check(I.girar(0) === 90 && I.girar(270) === 0 && igual(I.medidasGiradas(4, 3, 90), { ancho: 3, alto: 4 }) && igual(I.recorteValido({ x: -1, y: 0.99, w: 5, h: 0 }), { x: 0, y: 0.95, w: 1, h: 0.05 }),
    'el editor: girar de 90 en 90 y un recorte siempre dentro de la foto (de al menos el 5 %)');
  const rec = I.moverBorde({ x: 0, y: 0, w: 1, h: 1 }, 'izq', 0.2);
  check(Math.abs(rec.x - 0.2) < 1e-9 && Math.abs(rec.w - 0.8) < 1e-9 && I.moverBorde(rec, 'der', -0.3).w <= 0.5 + 1e-9 && I.moverBorde({ x: 0, y: 0, w: 1, h: 1 }, 'arr', 2).h >= 0.05, 'y sus bordes, con el teclado o el deslizador');

  const EM = await import('../web/src/logica/emojis.js');
  check(EM.conTono('👍', '\u{1F3FD}') === '👍\u{1F3FD}' && EM.conTono('✌️', '\u{1F3FB}') === '✌\u{1F3FB}' && EM.conTono('🏋️‍♀️', '\u{1F3FF}') === '🏋\u{1F3FF}‍♀️'
    && EM.conTono('😀', '\u{1F3FD}') === '😀' && EM.conTono('👍\u{1F3FD}', '') === '👍' && EM.admiteTono('🙏') && !EM.admiteTono('❤️'),
    'tonos de piel: en las manos y las personas que lo admiten (también en «🏋️‍♀️»); en las caras, no');
  check(EM.emojiValido('👍') && EM.emojiValido('👍🏽') && EM.emojiValido('🏳️‍🌈') && EM.emojiValido('🇪🇸') && EM.emojiValido('❤️') && !EM.emojiValido('ok') && !EM.emojiValido('👍 ') && !EM.emojiValido('‍')
    && !EM.emojiValido('‮👍') && !EM.emojiValido('👍'.repeat(17)) && !EM.emojiValido('') && EM.emojiValido('1️⃣') && EM.emojiValido('#⃣') && EM.emojiValido('*️⃣')
    && EM.emojiValido('\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}') && !EM.emojiValido('\u{E0067}\u{E0062}') && !EM.emojiValido('👍\u{E0067}') && !EM.emojiValido('\u{1F3F4}\u{E0067}\u{E0062}') && !EM.emojiValido('1') && !EM.emojiValido('a⃣'), 'una reacción es un emoji (cualquiera), como pide la base (034)');
  const almE = new Map(); const memE = { getItem: (k) => almE.get(k) ?? null, setItem: (k, v) => almE.set(k, v) };
  check(igual(EM.leerReacciones(memE, 'u1'), EM.REACCIONES_DEFECTO) && igual(EM.guardarReacciones(memE, 'u1', ['🔥', '🔥', 'ok', '🏆']).slice(0, 3), ['🔥', '🏆', '❤️']) && EM.leerReacciones(memE, 'u1').length === 6
    && igual(EM.leerReacciones(memE, 'u2'), EM.REACCIONES_DEFECTO), 'tus seis reacciones: distintas, válidas, completadas con las de siempre y por cuenta');
  EM.guardarTono(memE, '\u{1F3FE}');
  check(EM.leerTono(memE) === '\u{1F3FE}' && (EM.guardarTono(memE, 'x'), EM.leerTono(memE)) === '', 'el tono elegido se guarda en el móvil (solo uno de los seis)');

  const EN = await import('../web/src/logica/enlaces.js');
  const trucada = EN.tarjetaEnlace('https://ejemplo.com/factura%E2%80%AEfdp.exe%E2%80%8B%E2%81%A6x');
  check(trucada && !/[\u200b-\u200f\u202a-\u202e\u2060-\u2069]/.test(trucada.ruta) && trucada.ruta.includes('facturafdp.exe'), '(revisión) la ruta de la tarjeta, sin controles bidi ni invisibles (no se puede «dar la vuelta» al texto)');
  check(igual(EN.tarjetaEnlace('https://www.examine.com/supplements/creatine/'), { dominio: 'examine.com', ruta: '/supplements/creatine', seguro: true }) && EN.tarjetaEnlace('javascript:alert(1)') === null
    && EN.tarjetaEnlace('https://pubmed.ncbi.nlm.nih.gov/').ruta === '', 'la tarjeta de un enlace: su dominio y su ruta, sin pedir nada a nadie');

  const CH = await import('../web/src/logica/chat.js');
  const msgs = [{ id: 'f', archivo_id: 'a1', archivo: { tipo: 'adjunto', mime: 'image/jpeg' }, texto: 'Foto' }, { id: 'v', archivo_id: 'a2', archivo: { tipo: 'audio', mime: 'audio/webm' }, texto: 'Nota de voz' },
    { id: 'e', texto: 'mira https://examine.com' }, { id: 'd', archivo_id: 'a3', archivo: { tipo: 'documento', mime: 'application/pdf' }, texto: 'Documento' }, { id: 'x', archivo_id: 'a4', archivo: { tipo: 'audio' }, texto: 'Nota de voz', eliminado_en: '2026-01-01' }];
  check(igual(CH.porTipo(msgs, 'audio'), ['v']) && igual(CH.porTipo(msgs, 'enlace'), ['e']) && igual(CH.porTipo(msgs, 'foto'), ['f']) && igual(CH.porTipo(msgs, 'documento'), ['d']), 'buscar por tipo: fotos, enlaces, documentos y notas de voz (sin lo eliminado)');
  const dia = (iso) => iso.slice(0, 10);
  const porDia = [{ id: 'a', creado_en: '2026-10-01T10:00:00' }, { id: 'b', creado_en: '2026-10-05T10:00:00' }, { id: 'c', creado_en: '2026-10-09T10:00:00' }];
  check(CH.primeroDesde(porDia, '2026-10-05', dia) === 'b' && CH.primeroDesde(porDia, '2026-10-06', dia) === 'c' && CH.primeroDesde(porDia, '2026-10-10', dia) === null && CH.primeroDesde(porDia, 'ayer', dia) === null,
    'ir a una fecha: el primero de ese día (o del siguiente que tenga)');
  check(CH.ultimoEditable([{ id: 1, autor: 'atleta' }, { id: 2, autor: 'coach' }, { id: 3, autor: 'atleta', pendiente: true }], 'atleta', () => true)?.id === 1 && CH.ultimoEditable([{ id: 1, autor: 'atleta' }], 'atleta', () => false) === null,
    '↑ con el cuadro vacío: tu último mensaje que aún se puede editar');
  check(CH.debeSonar({}) && !CH.debeSonar({ activado: false }) && !CH.debeSonar({ silenciada: true }) && !CH.debeSonar({ visible: false }) && !CH.debeSonar({ alCargar: true }),
    'los sonidos: con el chat a la vista, activados y sin silenciar; nunca al cargar');
  check(igual(CH.llegadosNuevos([{ id: 1 }], [{ id: 1 }, { id: 2, autor: 'coach' }, { id: 3, autor: 'atleta' }], 'atleta').map((c) => c.id), [2]) && CH.numeroInsignia(140) === 99 && CH.numeroInsignia(-2) === 0,
    'lo que llega nuevo de la otra parte (para el tono) y el número del icono (hasta 99)');

  const M2 = await import('../web/src/logica/mensajes.js');
  check(M2.medioDe({ archivo: { tipo: 'audio', mime: 'audio/webm' } }) === 'audio' && M2.extractoCita({ archivo_id: 'x', archivo: { tipo: 'audio' }, texto: 'Nota de voz' }) === '🎤 Nota de voz'
    && M2.esMarcador({ archivo_id: 'x', texto: 'Nota de voz' }), 'una nota de voz: «🎤 Nota de voz» en las citas y la lista');
  const ahoraI = Date.parse('2026-11-03T19:00:00');
  const fila = (xs, k) => xs.find(([x]) => x === k)?.[1];
  const voz = { creado_en: '2026-11-03T18:42:00', entregado_en: '2026-11-03T18:43:00', leido_en: '2026-11-03T18:50:00', escuchado_en: '2026-11-03T18:51:00', archivo: { tipo: 'audio' } };
  check(fila(M2.infoMensaje(voz, ahoraI), 'Escuchado') === 'hoy 18:51' && fila(M2.infoMensaje({ ...voz, escuchado_en: null }, ahoraI), 'Escuchado') === 'todavía no' && fila(M2.infoMensaje(voz, ahoraI, { horaLeido: false }), 'Escuchado') === 'hoy'
    && !fila(M2.infoMensaje(voz, ahoraI, { horaLeido: false }), 'Entregado') && fila(M2.infoMensaje({ creado_en: voz.creado_en }, ahoraI), 'Escuchado') === undefined,
    '«Info del mensaje»: enviado, entregado, leído y (en una nota de voz) escuchado; con «en línea» apagado, sin horas y sin «entregado»');

  const { crearCacheChat, paraCache, MAX_CACHE } = await import('../web/src/datos/cacheChat.js');
  const almC = new Map();
  let relojC = Date.parse('2026-11-03T12:00:00Z');
  let cerradaC = false;
  const almacenC = { leer: async (k) => almC.get(k), guardar: async (k, v) => { almC.set(k, JSON.parse(JSON.stringify(v))); }, borrar: async (k) => { almC.delete(k); }, todo: async () => [...almC.entries()], borrarTodo: async () => almC.clear() };
  const cache = crearCacheChat({ almacen: almacenC, ahora: () => relojC, estaCerrada: () => cerradaC });
  const largos = Array.from({ length: 250 }, (_, i) => ({ id: `m${i}`, autor: 'coach', texto: `hola ${i}`, creado_en: '2026-11-03T10:00:00', archivo: i === 249 ? { id: 'a', ruta: 'x/adjunto-1.jpg', mime: 'image/jpeg', url: 'https://firmada', blob: 'x' } : null, enlaceFirmado: 'https://firmada' }));
  await cache.guardar('u1', 'at1', [...largos, { id: 'pendiente-1', pendiente: true, texto: 'saliendo' }]);
  const leido = await cache.leer('u1', 'at1');
  check(leido.mensajes.length === MAX_CACHE && leido.mensajes.at(-1).id === 'm249' && !leido.mensajes.some((c) => c.pendiente) && !('enlaceFirmado' in leido.mensajes[0]) && !('url' in leido.mensajes.at(-1).archivo) && !('blob' in leido.mensajes.at(-1).archivo),
    'la copia del chat en el móvil: los últimos 200, solo textos y datos (sin enlaces firmados ni archivos, ni lo que aún sale)');
  check(await cache.leer('u2', 'at1') === null && (await cache.leer('u1', 'at2')) === null, 'por cuenta y por conversación (lo de otra persona en el mismo móvil no se ve)');
  // (v0.58.1) «Hay más» con la copia del móvil: la copia (200) es más corta que la primera página (400); antes se
  // comparaban y nunca había más, así que arriba de lo guardado no se cargaba nada
  {
    const { hayAnteriores } = await import('../web/src/logica/chat.js');
    check(leido.completa === false && hayAnteriores({ cargados: leido.mensajes.length, limite: 400, desdeCache: true, cacheCompleta: leido.completa }),
      '(v0.58.1) la copia de una conversación de más de 200 no es «entera»: abriendo con ella, hay mensajes anteriores');
    await cache.guardar('u1', 'at1', largos, { completa: true });
    check((await cache.leer('u1', 'at1')).completa === false, '(v0.58.1) aunque la base diga que no hay más, si la copia se queda con los últimos 200, no es entera');
    await cache.guardar('u1', 'at1', largos.slice(0, 30), { completa: true });
    const corta = await cache.leer('u1', 'at1');
    check(corta.completa === true && !hayAnteriores({ cargados: 30, limite: 400, desdeCache: true, cacheCompleta: corta.completa }), '(v0.58.1) una conversación corta guardada entera: no hay nada más que cargar');
    await cache.guardar('u1', 'at1', largos.slice(0, 30));
    check((await cache.leer('u1', 'at1')).completa === false, '(v0.58.1) sin saberlo (o en una copia de antes, sin la marca), se supone que hay más');
    check(hayAnteriores({ cargados: 400, limite: 400 }) && !hayAnteriores({ cargados: 399, limite: 400 }) && hayAnteriores({ cargados: 600, limite: 600 }) && !hayAnteriores({ cargados: 656, limite: 800 }),
      '(v0.58.1) de la base: hay más si ha devuelto tantos como se pidieron (con el límite de esa respuesta)');
    const chatSrc = readFileSync(new URL('../web/src/ui/Chat.jsx', import.meta.url), 'utf8');
    const cssChat = readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');
    check(/hayAnteriores\(\{ cargados: mensajes\.length, limite: limiteDatos, desdeCache/.test(chatSrc) && !/mensajes\.length >= limite\b/.test(chatSrc)
      && /:root:has\(\.chat-lista\) \{ overflow-anchor: none; \}/.test(cssChat) && /volverAlAncla/.test(chatSrc),
      '(v0.58.1) el chat calcula «hay más» con la copia y con el límite de lo cargado, y ancla él mismo lo que se lee (sin el anclaje de Chromium)');
  }
  await cache.borrarTodo();
  check(await cache.leer('u1', 'at1') === null && paraCache([{ id: 'a' }]).length === 1 && await crearCacheChat({ almacen: null }).leer('u1', 'at1') === null, 'al cerrar la sesión se borra entera; sin IndexedDB, el chat abre como siempre');
  const appSrc = readFileSync(new URL('../web/src/ui/App.jsx', import.meta.url), 'utf8');
  check((appSrc.match(/borrarCacheChat\(\)/g) || []).length >= 2, 'se borra al cerrar sesión y cuando la sesión se acaba sola');
  // (revisión) Cerrada al salir (un guardado que llega tarde no la vuelve a crear), caduca a los 30 días y se limpia
  await cache.guardar('u1', 'at1', largos.slice(0, 3));
  cerradaC = true;
  check(!(await cache.guardar('u1', 'at9', largos.slice(0, 3))) && !almC.has('u1:at9') && await cache.leer('u1', 'at1') === null, '(revisión) con la sesión cerrada no se guarda ni se lee nada (un guardado tardío no la vuelve a crear)');
  cerradaC = false;
  relojC += 29 * 864e5;
  check((await cache.leer('u1', 'at1'))?.mensajes.length === 3, '(revisión) a los 29 días aún está');
  relojC += 2 * 864e5;
  check(await cache.leer('u1', 'at1') === null && !almC.has('u1:at1'), '(revisión) a los 30 días de la última vez que se abrió, caduca (y se borra)');
  await cache.guardar('u1', 'at1', largos.slice(0, 2)); await cache.guardar('u1', 'at2', largos.slice(0, 2)); await cache.guardar('u2', 'at3', largos.slice(0, 2));
  almC.set('u1:viejo', { perfil: 'u1', atleta: 'viejo', guardado_en: '2026-01-01T00:00:00Z', mensajes: [] });
  const quitadas = await cache.purgar('u1', { conservar: ['at1'] });
  check(quitadas === 2 && almC.has('u1:at1') && !almC.has('u1:at2') && almC.has('u2:at3') && !almC.has('u1:viejo'), '(revisión) en el móvil del coach se quita la de quien ya no está (borrado o de baja) y lo caducado; lo de otra cuenta, no se toca');
  await cache.quitarAtleta('u1', 'at1');
  check(!almC.has('u1:at1'), '(revisión) y al borrar un atleta, su conversación, al momento');
  const CC = await import('../web/src/datos/cacheChat.js');
  const promesa = CC.borrarCacheChat();
  check(CC.cacheCerrada(), '(revisión) borrarCacheChat() la cierra al momento (síncrono), antes de borrar nada');
  await promesa; CC.reabrirCacheChat();
  check(!CC.cacheCerrada() && /reabrirCacheChat\(\)/.test(appSrc) && /borrarCompartido\(\)/.test(appSrc) && (appSrc.match(/borrarCompartido\(\)/g) || []).length >= 2, '(revisión) se reabre al entrar; y al salir (o caducar la sesión) se borra también lo compartido desde otra app');
  const cacheSrc = readFileSync(new URL('../web/src/datos/cacheChat.js', import.meta.url), 'utf8');
  const convSrc = readFileSync(new URL('../web/src/ui/coach/Conversaciones.jsx', import.meta.url), 'utf8');
  check(/onversionchange/.test(cacheSrc) && /purgar\(perfil\.id, \{ conservar/.test(convSrc) && /estado !== 'baja'/.test(convSrc), '(revisión) si otra pestaña la cambia, se suelta; el coach purga al cargar sus conversaciones');

  // (v0.56) El aviso de privacidad, una vez por versión
  const PV = await import('../web/src/logica/privacidad.js');
  const { VERSION_LEGAL } = await import('../web/src/legal.js');
  check(VERSION_LEGAL === '2026-12.8' && PV.debeAvisarPrivacidad(null, '2026-11') && PV.debeAvisarPrivacidad('2026-10', '2026-11') && !PV.debeAvisarPrivacidad('2026-11', '2026-11') && !PV.debeAvisarPrivacidad('2026-12', '2026-11')
    && PV.debeAvisarPrivacidad('basura', '2026-11') && !PV.debeAvisarPrivacidad(null, 'x'), 'el aviso de privacidad: sale si no ha visto ninguna o una anterior; con la actual (o una más nueva), no');
  check(PV.versionMayor('2026-10', '2026-11') === '2026-11' && PV.versionMayor(null, '2026-10') === '2026-10' && PV.versionMayor('x', null) === null && PV.formatoVersion('2026-01') && !PV.formatoVersion('2026-13') && !PV.formatoVersion('26-1'),
    'la versión más nueva de las dos (la base y este móvil); solo con su formato');
  const nov11 = PV.NOVEDADES_PRIVACIDAD.filter((x) => x[3] === '2026-11');
  check(nov11.length === 4 && /micro/i.test(nov11.map((x) => x[2]).join(' ')) && /cerrar la sesión/.test(nov11[1][2]) && /GPS/.test(nov11[2][2]) && /voto/.test(nov11[3][2])
    && PV.clavePrivacidadLocal('u1') === 'fbe-privacidad-vista-u1', 'lo que cuenta: notas de voz y micro, la copia del chat (se borra al salir), fotos sin ubicación y los votos');
  check(/Ha visto la política de privacidad vigente/.test(PV.textoPrivacidadVista({ version: '2026-11' }, '2026-11')) && /Vio la política de 2026-10/.test(PV.textoPrivacidadVista({ version: '2026-10' }, '2026-11')) && /Sin constancia/.test(PV.textoPrivacidadVista(null, '2026-11')),
    'el coach lo ve en la ficha');
  const avisoSrc = readFileSync(new URL('../web/src/ui/AvisoPrivacidad.jsx', import.meta.url), 'utf8');
  check(/Entendido/.test(avisoSrc) && /alCerrar=\{cerrar\}/.test(avisoSrc) && /TextoPrivacidad/.test(avisoSrc) && !/preact\/compat/.test(avisoSrc), 'una hoja (Escape, fuera o «Entendido»: todo cuenta como vista), con la política entera a un toque');

  const { normalizarAjustes } = await import('../web/src/ui/ajustes.js');
  check(normalizarAjustes({}).sonidosChat === true && normalizarAjustes({ sonidosChat: false }).sonidosChat === false && normalizarAjustes({ fotosHd: 'sí' }).fotosHd === false, 'los ajustes nuevos: sonidos del chat (de serie, sí) y fotos en HD (de serie, no)');
  const sn = readFileSync(new URL('../web/src/ui/sonidos.js', import.meta.url), 'utf8');
  check(/createOscillator/.test(sn) && !/\.(mp3|ogg|wav|m4a)\b/.test(sn), 'los sonidos son tonos propios hechos al momento (sin archivos de audio de nadie)');
  const legal = readFileSync(new URL('../web/src/legal.js', import.meta.url), 'utf8');
  check(/EXIF/.test(legal) && /GPS/.test(legal) && /i\.ytimg\.com/.test(legal) && /micro/.test(legal) && /IndexedDB|copia de los últimos mensajes/.test(legal) && /notas de voz/i.test(legal), 'la privacidad cuenta lo nuevo: EXIF/GPS, YouTube, el micro, las notas de voz y la copia del chat en el móvil');
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  check(/img-src[^;]*https:\/\/i\.ytimg\.com/.test(html) && !/img-src[^;]*\*[ ;]/.test(html) && /media-src[^;]*blob:/.test(html), 'la CSP: solo las miniaturas de YouTube de fuera; el audio grabado (blob:) se puede escuchar antes de enviarlo');
}

console.log('\nv0.57: los vídeos de técnica (encuadre, nivel, serie, marcas, tempo, puntos clave, nota, estado, enlace, superponer, zoom, Mi técnica y limpieza)');
{
  const T = await import('../web/src/logica/tecnica.js');
  const D = await import('../web/src/logica/dibujo.js');
  // 1. Encuadre según el ejercicio
  check(T.encuadreDe('Sentadilla barra alta').vista === 'lado' && T.encuadreDe('Peso muerto rumano').vista === 'lado' && T.encuadreDe('Hip thrust con barra').vista === 'lado' && T.encuadreDe('Remo con barra').vista === 'lado',
    'de lado: sentadilla, peso muerto, hip thrust y remo');
  check(T.encuadreDe('Press banca').vista === '45' && T.encuadreDe('Press militar').vista === '45' && T.encuadreDe('Zancadas').vista === 'frente' && T.encuadreDe('Dominadas').vista === 'frente',
    'a 45° los press; de frente zancadas y dominadas');
  check(T.encuadreDe('Algo raro', ['cuadriceps']).vista === 'lado' && T.encuadreDe('', []).vista === 'lado' && /3 m/.test(T.encuadreDe('Sentadilla').texto), 'si no se sabe, de lado (por el grupo muscular o por defecto), con su explicación');
  // El nivel
  const n0 = T.nivelDe({ beta: 90, gamma: 0 }), nT = T.nivelDe({ beta: 70, gamma: 35 }), nL = T.nivelDe({ beta: 0, gamma: 90 }, 90);
  check(n0.estado === 'recto' && n0.vertical && Math.abs(n0.inclinacion) < 0.1 && nT.estado === 'torcido' && T.nivelDe({ beta: null, gamma: 3 }) === null && T.nivelDe({}) === null,
    'el nivel: el móvil vertical, recto; girado, torcido; sin datos (sin sensor), nada');
  check(Math.abs(nL.inclinacion) < 0.5 && /Torcido \d+°: gíralo/.test(T.textoNivel(nT)) && T.textoNivel(null) === 'Sin nivel en este móvil', 'en horizontal cuenta el giro de la pantalla; y lo dice en palabras');
  check(T.formatoVideo((t) => t === 'video/webm')?.tipo === 'video/webm' && T.formatoVideo((t) => t.startsWith('video/mp4'))?.ext === 'mp4' && T.formatoVideo(() => false) === null && T.formatoVideo(null) === null,
    'graba en MP4 si el navegador sabe (se avanza fotograma a fotograma) y si no, en WebM');
  check(/permiso/.test(T.errorCamara({ name: 'NotAllowedError' })) && /otra app/.test(T.errorCamara({ name: 'NotReadableError' })) && /galería/.test(T.errorCamara({})) && T.CUENTAS_ATRAS.join() === '3,5,10' && T.PARAR_SOLA.includes(0),
    'los errores de la cámara, claros; cuenta atrás de 3, 5 o 10 s y «parar sola» opcional');
  // 2. La serie
  check(T.textoSerieVideo({ kg: 62.5, reps: 5, rpe: 8.5 }) === '62,5 kg × 5 @8,5' && T.textoSerieVideo({ kg: null, reps: 12, rpe: null }) === '12 reps' && T.textoSerieVideo(null) === null,
    'la serie del vídeo: «62,5 kg × 5 @8,5» (sin carga, las repeticiones)');
  check(T.serieValida(null) && T.serieValida(1) && T.serieValida(30) && !T.serieValida(0) && !T.serieValida(31) && !T.serieValida(1.5), 'una serie, de 1 a 30 (como la base)');
  // 5. Marcas
  const coms = [{ id: 'a', texto: 'En 0:01,5 la cadera; en 0:02, bien', dibujo: { t: 2, hasta: 3, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] } }, { id: 'b', texto: 'Hora: 18:00', eliminado_en: null }, { id: 'c', texto: '0:03 borrado', eliminado_en: '2026-01-01' }];
  const ms = T.marcadores({ comentarios: coms, revision: { voz_archivo_id: 'v', voz_inicio: 0.5, checklist: { puntos: [{ t: 'Rodillas', e: 'mal', s: 1 }, { t: 'Pies', e: 'bien' }] } }, duracion: 8 });
  check(igual(ms.map((m) => [m.t, m.tipo]), [[0.5, 'voz'], [1, 'punto'], [1.5, 'comentario'], [2, 'comentario'], [2, 'dibujo']]), 'las marcas: voz, puntos con momento, minutos de los comentarios y dibujos; en orden, sin las horas ni lo eliminado');
  check(ms[1].etiqueta === 'Punto clave en 0:01,0: Rodillas' && ms[4].hasta === 3 && T.marcadores({ comentarios: [{ id: 'x', texto: '0:09' }], duracion: 5 }).length === 0, 'cada una con su nombre (para el lector de pantalla); fuera del vídeo, no');
  check(T.marcaVecina(ms, 1.2, 1).t === 1.5 && T.marcaVecina(ms, 1.2, -1).t === 1 && T.marcaVecina(ms, 9, 1) === null, 'la siguiente y la anterior (las teclas [ y ])');
  // 9. Tempo
  const { reps, aMedias } = T.repsDeMarcas([0, 1.5, 2.3, 2.5, 4, 4.8, 5.1]);
  check(reps.length === 2 && igual(aMedias, [5.1]) && T.tempoValido({ reps }, 8) && !T.tempoValido({ reps: [[0, 1, 0.5]] }) && !T.tempoValido({ reps: [[2, 3, 4], [1, 2, 3]] }) && !T.tempoValido({ reps: [[0, 1, 9.5]] }, 8),
    'el tempo: de tres en tres; en orden y dentro del vídeo (como la base)');
  check(T.tempoValido({ reps: [[0, 1, 2], [2, 3, 4]] }) && !T.tempoValido({ reps: [] }) && !T.tempoValido({ reps: Array.from({ length: 31 }, (_, i) => [i * 3, i * 3 + 1, i * 3 + 2]) }) && !T.tempoValido({ reps: [[0, 1, 2]], x: 1 }) && !T.tempoValido(null),
    'una repetición puede empezar donde acaba la anterior; de 1 a 30, sin campos de más');
  const tt = T.tablaTempo({ reps });
  check(tt.reps[0].bajada === 1.5 && tt.reps[0].subida === 0.8 && tt.media.bajada === 1.5 && T.textoSegundos(1.5) === '1,5 s' && T.tablaTempo(null).media === null, 'la tabla: bajada y subida de cada repetición y la media');
  check(T.marcaTempoValida([], 0.2, 8) && !T.marcaTempoValida([1], 0.5, 8) && T.marcaTempoValida([0, 1, 2], 2, 8) && !T.marcaTempoValida([0, 1], 1, 8) && !T.marcaTempoValida([], 20, 8), 'cada marca, después de la anterior y dentro del vídeo');
  // 12. Puntos clave
  check(T.checklistSugerido('Sentadilla barra alta').length >= 5 && T.checklistSugerido('Hip thrust').some((x) => /Tibias verticales/.test(x)) && T.checklistSugerido('Press banca').some((x) => /45°/.test(x))
    && T.checklistSugerido('Curl de bíceps').some((x) => /Recorrido completo/.test(x)), 'puntos sugeridos para los básicos (hip thrust aparte); para lo demás, unos generales');
  const todos = ['sentadilla', 'peso muerto', 'hip thrust', 'press banca', 'press militar', 'remo', 'dominadas', 'zancadas', 'curl'].flatMap((x) => T.checklistSugerido(x));
  check(T.plantillaValida(T.checklistSugerido('Press banca')) && todos.every((x) => [...x].length <= 120), 'todos caben en la lista del coach (hasta 120 letras)');
  check(!T.plantillaValida([]) && !T.plantillaValida(Array(16).fill('x')) && !T.plantillaValida(['  ']) && !T.plantillaValida(['x'.repeat(121)]) && igual(T.limpiarPlantilla([' a  b ', 'a b', '', 'c']), ['a b', 'c']),
    'la lista: de 1 a 15, sin vacíos ni repetidos');
  const ckBien = { puntos: [{ t: 'Rodillas', e: 'mal', s: 1.5 }, { t: 'Pies', e: 'bien' }] };
  check(T.checklistValido(ckBien) && !T.checklistValido({ puntos: [] }) && !T.checklistValido({ puntos: [{ t: 'x', e: 'si' }] }) && !T.checklistValido({ puntos: [{ t: ' ', e: 'bien' }] })
    && !T.checklistValido({ puntos: [{ t: 'x', e: 'bien', s: -1 }] }) && !T.checklistValido({ puntos: [{ t: 'x', e: 'bien', otro: 1 }] }) && !T.checklistValido([]), 'los puntos revisados, con su forma exacta (como la base)');
  check(igual(T.limpiarChecklist([{ t: 'A', e: 'bien', s: 1.234 }, { t: 'B', e: null }, { t: 'C', e: 'na' }]), { puntos: [{ t: 'A', e: 'bien', s: 1.2 }, { t: 'C', e: 'na' }] }) && T.limpiarChecklist([{ t: 'B', e: null }]) === null,
    'solo van los marcados; su momento, en décimas');
  check(igual(T.resumenChecklist(ckBien), { bien: 1, mal: 1, na: 0, total: 2 }), 'y su resumen');
  // 13. Nota de técnica
  check(T.puntuacionValida(null) && T.puntuacionValida(5) && !T.puntuacionValida(0) && !T.puntuacionValida(6) && !T.puntuacionValida(2.5) && T.NOMBRE_PUNTUACION[4] === 'Buena', 'la nota, de 1 a 5');
  const serie = T.seriePuntuaciones([{ fecha: '2026-10-01', revision: { puntuacion: 2 } }, { fecha: '2026-11-01', revision: { puntuacion: 4 }, creado_en: 'b' }, { fecha: '2026-11-01', revision: { puntuacion: 3 }, creado_en: 'a' }, { fecha: '2026-10-15', revision: null }]);
  check(igual(serie, [{ x: '2026-10-01', y: 2 }, { x: '2026-11-01', y: 4 }]), 'la gráfica de la nota: una por día (la última), sin los que no tienen');
  // 15. Estado
  check(T.estadoVideo({}).estado === 'enviado' && T.estadoVideo({ revision: { visto_el: '2026-11-03' } }).texto === 'Visto el 3 nov' && T.estadoVideo({ revision: { visto_el: '2026-11-03', corregido_el: '2026-11-03' } }).estado === 'corregido'
    && T.estadoVideo({ respondido: true }).texto === 'Corregido', 'Enviado → Visto (el día) → Corregido (la corrección o una respuesta del coach)');
  const id = '11111111-1111-4111-8111-111111111111';
  check(T.enlaceVideo(id, 1.234) === `#videos/${id}@1.2` && T.enlaceVideo(id) === `#videos/${id}` && T.enlaceVideo('../x', 2) === null && igual(T.leerEnlaceVideo(`#videos/${id}@1.2`), { id, t: 1.2 })
    && igual(T.leerEnlaceVideo(`#videos/${id}`), { id, t: null }) && T.leerEnlaceVideo(`#videos/${id}@1.23`) === null && T.leerEnlaceVideo('#videos/../evil') === null && T.leerEnlaceVideo(`#videos/${id}@12345`) === null,
    'el enlace del aviso: #videos/<id>@<segundos con una décima>, nada más (como la base)');
  const sql = readFileSync(new URL('../supabase/migraciones/035_videos_tecnica.sql', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  const mainJs = readFileSync(new URL('../web/src/main.jsx', import.meta.url), 'utf8');
  check(sql.includes("'^#videos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@[0-9]{1,4}(\\.[0-9])?)?$'") && sw.includes('#videos\\/[0-9a-f]{8}') && mainJs.includes('#videos\\/[0-9a-f-]{36}(@[0-9]{1,4}'),
    'la base, el service worker y la app aceptan la misma dirección (anclada)');
  // 8. Superponer y la voz al ritmo
  check(T.tiempoOtro(2, 1, 0.5) === 1.5 && T.tiempoOtro(0, 1, 0.5) === 0 && T.tiempoOtro(9, 0, 0, 6) === 6, 'superpuestos: el otro, en el mismo punto de su repetición (dentro de su vídeo)');
  check(T.tiempoVoz(2, 0.5, 3) === 1.5 && T.tiempoVoz(0.2, 0.5, 3) === null && T.tiempoVoz(4, 0.5, 3) === null, 'la voz: su momento según el del vídeo (fuera de su tramo, callada)');
  // 10. Zoom
  check(T.limitarZoom(9) === 4 && T.limitarZoom(0.2) === 1 && T.limitarZoom(NaN) === 1 && igual(T.limitarPan({ x: 500, y: -500 }, 2, 300, 400), { x: 150, y: -200 }) && igual(T.limitarPan({ x: 5, y: 5 }, 1, 300, 400), { x: 0, y: 0 }),
    'el zoom, de 1× a 4×; la imagen siempre tapa su caja');
  // 16. Mi técnica
  const vids = [{ tipo: 'video_tecnica', id: '1', fecha: '2026-09-01', ejercicio: { id: 's', nombre: 'Sentadilla' }, revision: { puntuacion: 2 } }, { tipo: 'video_tecnica', id: '2', fecha: '2026-11-01', ejercicio: { id: 's', nombre: 'Sentadilla' }, revision: { puntuacion: 4 } },
    { tipo: 'video_tecnica', id: '3', fecha: '2026-10-01', ejercicio: { id: 'p', nombre: 'Press' } }, { tipo: 'video_tecnica', id: '4', fecha: '2026-11-02', ejercicio: null }, { tipo: 'foto_progreso', id: '5', fecha: '2026-11-02' }];
  const gr = T.tecnicaPorEjercicio(vids);
  check(gr.map((g) => g.id).join() === 's,p,sin' && gr[0].videos[0].id === '2' && gr[0].ultima === 4 && gr[0].puntos.length === 2 && gr[1].ultima === null, '«Mi técnica»: por ejercicio (el más reciente primero, «Sin ejercicio» al final), cada uno con su gráfica');
  // 14. Orden de «Revisar seguidos»
  const cola = [{ id: 'a', creado_en: '3', atleta: { nombre: 'Rubén' }, ejercicio: { nombre: 'Press' } }, { id: 'b', creado_en: '1', atleta: { nombre: 'Ana' }, ejercicio: { nombre: 'Sentadilla' } }, { id: 'c', creado_en: '2', atleta: { nombre: 'Ana' }, ejercicio: null }];
  check(T.ordenarCola(cola).map((x) => x.id).join() === 'b,c,a' && T.ordenarCola(cola, 'atleta').map((x) => x.id).join() === 'b,c,a' && T.ordenarCola(cola, 'ejercicio').map((x) => x.id).join() === 'a,b,c',
    'revisar seguidos: los más antiguos, por atleta o por ejercicio');
  // 17. Limpieza y almacenamiento
  check(T.restarMeses('2026-03-31', 1) === '2026-02-28' && T.restarMeses('2026-01-15', 2) === '2025-11-15' && T.restarMeses('2024-03-30', 1) === '2024-02-29', 'restar meses (fin de mes y años bisiestos)');
  const ahora = Date.parse('2026-11-03T12:00:00Z');
  const viejoV = (id, x = {}) => ({ id, tipo: 'video_tecnica', fecha: '2026-01-01', creado_en: '2026-01-01T10:00:00Z', revisado_en: '2026-01-02T10:00:00Z', ...x });
  const arch = [viejoV('v1'), viejoV('v2', { destacado: true }), viejoV('v3', { fecha: '2026-10-01', creado_en: '2026-10-01T10:00:00Z' }),
    viejoV('v4'), viejoV('v5'), viejoV('v6'), { id: 'v7', tipo: 'foto_progreso', fecha: '2026-01-01', creado_en: '2026-01-01T10:00:00Z' },
    viejoV('v8', { fecha: '2026-11-01', repite_de: 'v6', creado_en: '2026-11-01T10:00:00Z' }),
    // (v0.57, revisión de seguridad) con el día puesto a mano: cuenta también cuándo llegó; sin revisar ni corregir, en la cola
    viejoV('v9', { creado_en: '2026-10-20T10:00:00Z' }), viejoV('v10', { revisado_en: null }), viejoV('v11', { revisado_en: null }), viejoV('v12'), viejoV('v13')];
  const revs = [{ archivo_id: 'v11', corregido_en: '2026-01-03T10:00:00Z', actualizado_en: '2026-01-03T10:00:00Z' },
    { archivo_id: 'v12', corregido_en: null, visto_el: '2026-11-02', actualizado_en: '2026-11-02T10:00:00Z' }, { archivo_id: 'v13', corregido_en: '2026-01-03T10:00:00Z', actualizado_en: '2026-11-02T10:00:00Z' }];
  const viejos = T.videosViejos(arch, { comentarios: [{ archivo_id: 'v4', creado_en: '2026-10-30T10:00:00Z' }], tareas: [{ archivo_id: 'v5', revisada_en: null }], revisiones: revs, meses: 6, dias: 30, hoy: '2026-11-03', ahora });
  check(igual(viejos.map((a) => a.id), ['v1', 'v11', 'v12']), 'limpieza: de más de 6 meses, sin destacar, sin conversación reciente, ni de una tarea por revisar, ni con una repetición reciente (y solo vídeos de técnica)');
  check(!viejos.some((a) => a.id === 'v9') && !viejos.some((a) => a.id === 'v10') && viejos.some((a) => a.id === 'v11') && viejos.some((a) => a.id === 'v12') && !viejos.some((a) => a.id === 'v13'),
    'un día puesto a mano no lo hace viejo (cuenta cuándo llegó); el que espera en la cola del coach no se borra; abrirlo («Visto») no lo protege, corregirlo hace poco, sí');
  check(T.DIAS_LIMPIEZA_MIN === 7 && /not between 7 and 365/.test(sql), 'la protección de la conversación, de al menos 7 días (como la base)');
  check(T.avisoAlmacenamiento(0.5 * 1024 ** 3, 1).nivel === 'ok' && T.avisoAlmacenamiento(0.85 * 1024 ** 3, 1).nivel === 'cerca' && T.avisoAlmacenamiento(0.97 * 1024 ** 3, 1).nivel === 'lleno'
    && T.avisoAlmacenamiento(0.85 * 1024 ** 3, 100).nivel === 'ok' && /85 %/.test(T.avisoAlmacenamiento(0.85 * 1024 ** 3, 1).texto), 'el aviso del almacenamiento: desde el 80 % del plan (y casi lleno desde el 95 %)');
  // 6. Dibujos: más herramientas, colores y tramo
  const nuevo = { t: 1, hasta: 2.5, formas: [{ tipo: 'flecha', p: [[0, 0], [1, 1]], c: 'rojo' }, { tipo: 'circulo', p: [[0.5, 0.5], [0.6, 0.6]] }, { tipo: 'lapiz', p: [[0, 0], [0.1, 0.1], [0.2, 0.3]] }, { tipo: 'texto', p: [[0.5, 0.5]], x: 'Rodillas' }] };
  check(D.dibujoValido(nuevo) && D.dibujoValido({ t: 2, formas: [{ tipo: 'angulo', p: [[0.47, 0.66], [0.58, 0.49], [0.3, 0.73]] }] }), 'dibujos nuevos (flecha, círculo, lápiz, texto, color y tramo); los de antes siguen valiendo');
  check(!D.dibujoValido({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]] }] }) && !D.dibujoValido({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], x: 'a' }] }) && !D.dibujoValido({ t: 1, hasta: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] })
    && !D.dibujoValido({ t: 1, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]], c: 'verde' }] }) && !D.dibujoValido({ t: 1, formas: [{ tipo: 'lapiz', p: [[0, 0]] }] }) && !D.dibujoValido({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]], x: ' ​ ' }] })
    && !D.dibujoValido({ t: 1, formas: [{ tipo: 'texto', p: [[0, 0]], x: 'x'.repeat(41) }] }) && !D.dibujoValido({ t: 1, formas: Array(25).fill({ tipo: 'linea', p: [[0, 0], [1, 1]] }) }) && D.dibujoValido({ t: 1, formas: Array(24).fill({ tipo: 'linea', p: [[0, 0], [1, 1]] }) }),
    'con su forma exacta (como la base): texto de 1 a 40 letras visibles, colores de la lista, tramo que acaba después, lápiz de 2 a 80 puntos, hasta 24 formas');
  const l2 = D.limpiarDibujo(1.04, [{ tipo: 'lapiz', p: Array.from({ length: 200 }, (_, i) => [i / 200, 0.5]) }, { tipo: 'texto', p: [[0.5, 0.5]], x: '  Rodillas  ', c: 'amarillo' }, { tipo: 'flecha', p: [[0, 0], [1, 1]], c: 'cian' }], { hasta: 2.06 });
  check(l2.t === 1 && l2.hasta === 2.1 && l2.formas[0].p.length === 80 && l2.formas[1].x === 'Rodillas' && !('c' in l2.formas[1]) && l2.formas[2].c === 'cian' && !('hasta' in D.limpiarDibujo(1, [{ tipo: 'linea', p: [[0, 0], [1, 1]] }], { hasta: 0.5 })),
    'lo que se guarda: el lápiz aligerado a 80 puntos, el texto recortado, el amarillo (el de siempre) sin color, y el tramo solo si acaba después');
  check(D.dibujoVisible({ t: 1, formas: [] }, 1.2) && !D.dibujoVisible({ t: 1, formas: [] }, 1.5) && D.dibujoVisible({ t: 1, hasta: 3, formas: [] }, 2.5) && !D.dibujoVisible({ t: 1, hasta: 3, formas: [] }, 3.2), 'un dibujo se ve en su fotograma o durante su tramo');
  check(D.describirDibujo(nuevo) === 'una flecha, un círculo, un trazo y el texto «Rodillas»' && D.describirDibujo({ formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }, { tipo: 'flecha', p: [[0, 0], [1, 1]] }, { tipo: 'flecha', p: [[0, 0], [1, 1]] }] }) === 'una línea y 2 flechas',
    'descrito en palabras (para quien no lo ve)');
  check(sql.includes("'linea', 'angulo', 'flecha', 'circulo', 'lapiz', 'texto'") && D.COLORES_DIBUJO.every(([k]) => sql.includes(`'${k}'`)) && /between 1 and 24/.test(sql) && D.MAX_FORMAS === 24, 'las mismas herramientas, colores y tope que la base');
  // Los colores del dibujo se distinguen sobre el vídeo (borde oscuro) y cada uno lleva su nombre
  check(D.COLORES_DIBUJO.length === 5 && D.COLORES_DIBUJO.every(([k, n, h]) => k && n && /^#[0-9A-F]{6}$/i.test(h)) && D.HEX_COLOR.amarillo === '#F2C230', 'cinco colores con nombre; el amarillo, el de siempre');
  // Privacidad y otras comprobaciones del código
  const legal = await import('../web/src/legal.js');
  const filaV = legal.PRIVACIDAD.find(([t]) => t === 'Tus vídeos de técnica')?.[1] || '';
  const filaM = legal.PRIVACIDAD.find(([t]) => t === 'Lo que se queda en tu móvil')[1];
  check(/nota de técnica de 1 a 5/.test(filaV) && /su voz sobre el vídeo/.test(filaV) && /el día \(no la hora\)/.test(filaV) && /sensor de inclinación/.test(filaV) && /destacados no se borran nunca/.test(filaV)
    && /por donde iba/.test(filaM) && /^2026-1[12](\.[1-9])?$/.test(legal.VERSION_LEGAL), 'la privacidad lo cuenta (la corrección, la voz, «Visto» solo con el día, el nivel, la limpieza y la subida que sigue; la versión, en la v0.58)');
  const src = (f) => readFileSync(new URL(`../web/src/ui/${f}`, import.meta.url), 'utf8');
  const cam = src('tecnica/CamaraVideo.jsx');
  check((cam.match(/soltarCamara\(\)/g) || []).length >= 5 && /audio: false/.test(cam) && /requestPermission/.test(cam) && !/preact\/compat/.test(cam + src('tecnica/Correccion.jsx') + src('tecnica/RevisionSeguida.jsx') + src('tecnica/MiTecnica.jsx') + src('Video.jsx')),
    'la cámara se suelta al parar, cancelar, fallar y cerrar; graba sin sonido; pide el permiso del nivel en iPhone; sin preact/compat');
  const css = readFileSync(new URL('../web/src/estilos.css', import.meta.url), 'utf8');
  check(/prefers-reduced-motion: reduce\) \{ \.rep-zoom\.suave/.test(css) && !/@keyframes seguida-[a-z]+ \{[^}]*opacity/.test(css), 'con «reducir movimiento», nada se mueve; y las animaciones nuevas, sin opacidad (solo transform)');
}

console.log('\nv0.58: el análisis automático de los vídeos (seguir la barra, la velocidad, los puntos del cuerpo y lo que se guarda)');
{
  const A = await import('../web/src/logica/analisis.js');
  const { VALIDOS, MALFORMADOS } = await import('./analisis-casos.mjs');
  // 18. La NCC y el seguidor sobre fotogramas sintéticos (un disco con su aro y su buje sobre un fondo con ruido)
  check(Math.abs(A.ncc(Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([2, 4, 6, 8])) - 1) < 1e-9 && Math.abs(A.ncc(Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([4, 3, 2, 1])) + 1) < 1e-9
    && A.ncc(Uint8Array.from([5, 5, 5]), Uint8Array.from([1, 2, 3])) === 0, 'la NCC: 1 si son iguales (aunque cambie el brillo), −1 al revés y 0 si una es plana');
  const w = 180, h = 320;
  let semilla = 7; const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const fondo = new Uint8Array(w * h).map(() => 90 + Math.floor(azar() * 50));
  const disco = (cx, cy, r, brillo = 0) => { const g = Uint8Array.from(fondo); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) g[y * w + x] = Math.min(255, (d < r * 0.25 ? 220 : d > r * 0.8 ? 30 : 60 + Math.floor(azar() * 10)) + brillo); } return g; };
  {
    const I = A.integrales(fondo, w, h);
    const tpl = A.plantillaDe(fondo, w, h, 50, 60, 6);
    const ventana = []; for (let y = 54; y <= 66; y++) for (let x = 44; x <= 56; x++) ventana.push(fondo[y * w + x]);
    check(Math.abs(A.nccEn(fondo, w, h, I, tpl, 50, 60) - 1) < 1e-6 && Math.abs(A.ncc(Uint8Array.from(ventana), Float32Array.from(tpl.d)) - 1) < 1e-6 && A.nccEn(fondo, w, h, I, tpl, 2, 2) === null,
      'la NCC con imágenes integrales da lo mismo que la directa (y nada si la ventana se sale)');
  }
  const tray = (i) => [90 + 4 * Math.sin(i / 9), 100 + 120 * (1 - Math.cos(i / 15)) / 2];
  const [x0, y0] = tray(0);
  const seg = A.crearSeguidor(disco(x0, y0, 20), w, h, { x: x0, y: y0, r: 20 });
  let err = 0, noOk = 0;
  for (let i = 1; i < 150; i++) { const [x, y] = tray(i); const r = seg.paso(disco(x, y, 20)); if (r.estado !== 'ok') noOk++; err = Math.max(err, Math.hypot(r.x - x, r.y - y)); }
  check(noOk === 0 && err < 0.75, `sigue el disco 150 fotogramas (sube, baja y se va a los lados) con menos de 0,75 px de error (${err.toFixed(2)} px)`);
  const est = [seg.paso(fondo).estado, seg.paso(fondo).estado, seg.paso(fondo).estado];
  check(est.join() === 'dudoso,dudoso,perdido', 'si el disco desaparece: dos fotogramas dudosos y, al tercero, perdido');
  {
    const s2 = A.crearSeguidor(disco(90, 100, 18), w, h, { x: 90, y: 100, r: 18 });
    let ok2 = true;
    for (let i = 1; i <= 60; i++) { const r = s2.paso(disco(90, 100 + i, 18, Math.round(i * 0.8))); if (r.estado !== 'ok' || Math.abs(r.y - (100 + i)) > 1) ok2 = false; }
    check(ok2, 'y no lo pierde si la luz cambia poco a poco (la plantilla se actualiza despacio)');
  }
  check(A.crearSeguidor(fondo, w, h, { x: 2, y: 2, r: 10 }) === null && A.crearSeguidor(new Uint8Array(w * h).fill(80), w, h, { x: 90, y: 90, r: 10 }) === null, 'no empieza con un círculo que se sale de la imagen o sobre algo plano');
  const tp = A.tamProceso(1080, 1920, 100);
  check(tp.w <= 360 && Math.abs(tp.w / tp.h - 1080 / 1920) < 0.01 && 100 * tp.k <= 20.01 && A.tamProceso(360, 640, 10).w === 360, 'se procesa a 360 px de ancho como mucho (menos si el disco es grande: su radio, ~20 px)');
  const tra = A.tramoAnalisis(5, 200, 180);
  check(tra.t0 === 5 && tra.t1 === 65 && tra.recortado && A.momentosDe(0, 1).length === 31 && !A.tramoAnalisis(0, 3, 3).recortado, 'como mucho 60 s; un fotograma cada 1/30 s');
  // 19. Repeticiones y velocidad con trayectorias sintéticas: 3 sentadillas (bajada de 0,7 s; subidas de 0,8, 0,9 y 1,05 s; 80 cm)
  const W = 360, H = 640, cal = A.calibracion(45, 90, W, H);
  const fases = [[0.4, 'q'], [0.7, 'b'], [0.8, 's'], [0.7, 'b'], [0.9, 's'], [0.7, 'b'], [1.05, 's'], [0.4, 'q']];
  const yDe = (t) => { let a = 0; for (const [d, f] of fases) { if (t <= a + d) { const c = (1 - Math.cos(Math.PI * (t - a) / d)) / 2; return f === 'q' ? 200 : f === 'b' ? 200 + 160 * c : 360 - 160 * c; } a += d; } return 200; };
  const total = fases.reduce((x, f) => x + f[0], 0);
  const pts = []; for (let t = 0; t <= total; t += 1 / 30) pts.push([Math.round(t * 1000) / 1000, 0.5, yDe(t) / H]);
  const reps = A.repeticiones(pts, { cal });
  const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
  check(reps.length === 3 && [1, 0.889, 0.762].every((v, i) => cerca(reps[i].vm, v, v * 0.05)), `3 repeticiones; la velocidad media de cada subida, con menos de un 5 % de error (${reps.map((r) => r.vm).join(', ')} m/s)`);
  check(reps.every((r) => cerca(r.rom, 80, 3)) && [0.8, 0.9, 1.05].every((d, i) => cerca(reps[i].dc, d, 0.06)) && [1, 0.889, 0.762].every((v, i) => cerca(reps[i].vp, (Math.PI / 2) * v, 0.08 * v * Math.PI / 2)),
    'el recorrido (80 cm), lo que dura cada subida y la velocidad pico (π/2 de la media en una sinusoide), dentro de su margen');
  check(reps.every((r) => r.t[0] <= r.t[1] && r.t[1] <= r.t[2]) && cerca(reps[0].t[0], 0.4, 0.1) && cerca(reps[0].t[1], 1.1, 0.06), 'cada una con sus momentos: empieza a bajar, abajo y arriba');
  // Con ruido (medio píxel) y un 20 % de fotogramas perdidos
  semilla = 3;
  const gauss = () => Math.sqrt(-2 * Math.log(azar() + 1e-12)) * Math.cos(2 * Math.PI * azar());
  const ruido = pts.filter(() => azar() > 0.2).map(([t, x, y]) => [t, x + (gauss() * 0.5) / W, y + (gauss() * 0.7) / H]);
  const rr = A.repeticiones(ruido, { cal });
  check(rr.length === 3 && [1, 0.889, 0.762].every((v, i) => cerca(rr[i].vm, v, v * 0.08)), `con ruido y fotogramas perdidos, igual: 3 y su velocidad (${rr.map((r) => r.vm).join(', ')})`);
  // Peso muerto: desde el suelo, una rampa a velocidad constante (0,5 m/s) con 0,15 s para arrancar y para frenar: 60 cm en
  // 1,35 s (media de verdad, 0,444 m/s; pico, 0,5)
  const posRampa = (t) => { const ta = 0.15, D = 1.35, v = 0.6 / (D - ta); const u = t - 0.5; if (u <= 0) return 0; if (u >= D) return 0.6;
    if (u < ta) return (v * u * u) / (2 * ta); if (u > D - ta) { const r = D - u; return 0.6 - (v * r * r) / (2 * ta); } return (v * ta) / 2 + v * (u - ta); };
  const rampa = []; for (let t = 0; t <= 3.5; t += 1 / 30) rampa.push([t, 0.5, (500 - posRampa(t) / 0.005) / H]);
  const rm = A.repeticiones(rampa, { cal });
  check(rm.length === 1 && cerca(rm[0].vm, 0.444, 0.444 * 0.08) && cerca(rm[0].vp, 0.5, 0.025) && cerca(rm[0].rom, 60, 2) && cerca(rm[0].dc, 1.35, 0.08), `una rampa a velocidad constante (como un peso muerto desde el suelo): ${rm[0]?.vm} m/s de media, ${rm[0]?.vp} de pico, ${rm[0]?.rom} cm`);
  const rmR = A.repeticiones(rampa.map(([t, x, y]) => [t, x, y + (gauss() * 0.7) / H]), { cal });
  check(rmR.length === 1 && cerca(rmR[0].vm, 0.444, 0.444 * 0.08), `y con ruido en las pausas de abajo y de arriba, igual (${rmR[0]?.vm} m/s: el ruido no alarga la subida)`);
  check(A.repeticiones(pts.map(([t, x]) => [t, x, 0.5 + (gauss() * 0.5) / H]), { cal }).length === 0 && A.repeticiones([], { cal }).length === 0, 'sin movimiento (solo ruido), ninguna repetición');
  const sinCal = A.repeticiones(pts);
  check(sinCal.length === 3 && sinCal.every((r) => r.vm == null && r.rom == null && r.dc > 0), 'sin calibrar: las mismas repeticiones y lo que dura cada subida, sin m/s ni cm');
  const res = A.resumenSerie(reps);
  check(res.mejor === 0 && cerca(res.perdidaMejor, 23.8, 3) && res.perdidaPrimera === res.perdidaMejor && A.resumenSerie(sinCal) === null, `la mejor (la 1.ª) y la pérdida de velocidad de la mejor a la última (${res.perdidaMejor} %)`);
  const unidas = A.unirReps(pts, reps, 0, { cal });
  const partidas = A.partirRep(pts, unidas, 0, 1.9, { cal });
  check(unidas.length === 2 && unidas[0].t[1] === reps[0].t[1] && cerca(unidas[0].t[2], reps[1].t[2], 0.05) && partidas.length === 3 && partidas.every((r, i) => cerca(r.vm, reps[i].vm, 0.03)),
    'el coach une dos repeticiones (de lo más bajo de la primera a lo más alto de la segunda) y, al partirla, vuelven a ser las de antes');
  check(A.partirRep(pts, reps, 0, 99, { cal }) === reps && A.unirReps(pts, reps, 2, { cal }) === reps, 'partir fuera de la repetición o unir la última no cambia nada');
  const dv = A.desvioHorizontal([[0, 0.5, 0.5], [1, 0.48, 0.5], [2, 0.53, 0.5]], cal);
  check(dv.unidad === 'cm' && cerca(dv.izq, 3.6, 0.1) && cerca(dv.der, 5.4, 0.1) && A.desvioHorizontal([[0, 0.5, 0.5], [1, 0.4, 0.5]]).unidad === '%', 'cuánto se separa la barra de la vertical del principio (en cm, o en % del ancho sin calibrar)');
  const fs = A.fasesTrayectoria(pts);
  check(fs.some((f) => f.fase === 'baja') && fs.some((f) => f.fase === 'sube') && fs.filter((f) => f.fase === 'sube').length === 3, 'la trayectoria, en tramos de bajada y de subida (para pintarlos de dos colores)');
  const po = A.posicionEn([[0, 0.2, 0.4], [0.2, 0.4, 0.6]], 0.1);
  check(cerca(po[0], 0.3, 1e-9) && cerca(po[1], 0.5, 1e-9) && A.posicionEn([[0, 0.2, 0.4], [0.2, 0.4, 0.6]], 2) === null && A.posicionEn([[0, 0.2, 0.4], [3, 0.4, 0.6]], 1) === null && A.repEn(reps, reps[1].t[1]) === 1,
    'dónde está la barra en cada momento (y nada fuera de la trayectoria o en un hueco); en qué repetición está el vídeo');
  check(cal && cal.px === 90 && A.calibracion(9, 90, W, H) === null && A.calibracion(61, 90, W, H) === null && A.calibracion(45, 0, W, H) === null && A.calibracion(45, 90, 0, H) === null
    && cerca(A.diametroPx([0.25, 0.5], [0.5, 0.5], W, H), 90, 1e-9) && cerca(A.metrosPorPx(cal), 0.005, 1e-12) && A.DISCOS_CM.join() === '45,40,35,25' && A.DISCO_CM === 45,
    'la calibración: un disco de 10 a 60 cm (45 de serie) y su diámetro en píxeles (o dos toques de lado a lado)');
  // 20. Los ángulos
  check(cerca(A.angulo([0, 0], [1, 0], [1, 1]), 90, 1e-9) && cerca(A.angulo([0, 0], [1, 0], [2, 0]), 180, 1e-9) && A.angulo([1, 0], [1, 0], [2, 0]) === null
    && cerca(A.inclinacionTronco([0, 10], [0, 0]), 0, 1e-9) && cerca(A.inclinacionTronco([0, 0], [10, 0]), 90, 1e-9) && cerca(A.inclinacionTronco([0, 10], [10, 0]), 45, 1e-9),
    'los ángulos de 0 a 180° y la inclinación del tronco desde la vertical (0° erguido, 90° tumbado)');
  const kp = Array.from({ length: 33 }, () => [0.5, 0.5, 0.1]);
  const pon = (i, x, y, v = 0.9) => { kp[i] = [x, y, v]; };
  pon(11, 0.5, 0.3); pon(13, 0.55, 0.4); pon(15, 0.65, 0.4); pon(23, 0.5, 0.55); pon(25, 0.6, 0.55); pon(27, 0.6, 0.75);
  const g = A.angulosDe(kp, 'izq', 1, 1);
  check(cerca(g.rodilla, 90, 0.1) && cerca(g.cadera, 90, 0.1) && cerca(g.tronco, 0, 0.1) && g.codo > 90 && A.angulosDe(kp, 'der', 1, 1).rodilla === null, 'los ángulos de un fotograma (rodilla, cadera, tronco y codo) del lado elegido; lo que no se ve, sin ángulo');
  const fotos = [0, 0.5, 1, 1.5, 2].map((t) => ({ t, kp: kp.map((q, i) => (i === 25 ? [0.6 - 0.05 * t, 0.55, 0.9] : q)) }));
  check(A.ladoProbable(fotos) === 'izq' && A.ladoProbable(fotos.map((f) => ({ ...f, kp: f.kp.map((q, i) => (i % 2 === 0 && i > 10 ? [q[0], q[1], 0.95] : q)) }))) === 'der', 'el lado que se ve mejor (el que mira a la cámara)');
  const rp = A.resumenPose(fotos, [{ t: [0, 0.5, 1] }, { t: [1.5, 1.7, 2] }], 'izq', { codo: true });
  check(rp.length === 2 && rp[0].rodilla === Math.round(Math.min(...[0, 0.5, 1].map((t) => A.angulosDe(fotos[t * 2].kp, 'izq').rodilla))) && rp[0].tronco === 0 && rp[0].codo != null && rp[0].t.join() === '0,1' && A.poseEn(fotos, 0.55).t === 0.5 && A.poseEn(fotos, 5) === null,
    'por repetición: la rodilla mínima (profundidad), el tronco más inclinado y el codo (en los press)');
  // Lo que se guarda: igual que analisis_valido() en la base
  check(VALIDOS.every((j) => A.analisisValido(JSON.parse(j))), `los análisis bien formados valen (${VALIDOS.length}, también el máximo: 900 puntos y 30 repeticiones)`);
  const malos = MALFORMADOS.filter((j) => A.analisisValido(JSON.parse(j)));
  check(MALFORMADOS.length >= 40 && !malos.length, `y ${MALFORMADOS.length} mal formados, no (forma, tipos, límites, claves de más, la pose cruda y más de 64 kB)${malos.length ? `: ${malos[0].slice(0, 80)}` : ''}`);
  check(A.tamJsonb({ a: 1, b: [1, 2] }) === '{"a": 1, "b": [1, 2]}'.length && A.tamJsonb(JSON.parse(MALFORMADOS.reduce((x, y) => (y.length > x.length ? y : x)))) > A.MAX_BYTES_ANALISIS && A.tamJsonb(JSON.parse(VALIDOS.reduce((x, y) => (y.length > x.length ? y : x)))) < A.MAX_BYTES_ANALISIS,
    'el tamaño se mide como lo guarda la base (jsonb::text, con sus espacios): como mucho 64 kB');
  check(!A.analisisValido({ v: 1, barra: { p: [[0, 0.5, 0.5], [5.9, 0.5, 0.5]] } }, 4.8) && A.analisisValido({ v: 1, barra: { p: [[0, 0.5, 0.5], [5.9, 0.5, 0.5]] } }, 5) && !A.analisisValido({ v: 1, pose: { lado: 'izq', reps: [{ t: [0, 9], rodilla: 90 }] } }, 7), 'nada después del final del vídeo (con 1 s de margen, como el trigger)');
  const largos = []; for (let t = 0; t <= 60; t += 1 / 30) largos.push([t, 0.5 + 0.0001234 * Math.sin(t), 0.3 + 0.2 * Math.sin(t)]);
  const limpio = A.limpiarAnalisis({ barra: { p: largos }, cal, reps: A.repeticiones(largos, { cal }), pose: { lado: 'der', reps: [{ t: [0, 1], rodilla: 85.4, tronco: 190 }] } });
  check(limpio.barra.p.length <= 900 && limpio.barra.p.at(-1)[0] === Math.round(largos.at(-1)[0] * 1000) / 1000 && limpio.barra.p.every((q) => q.every((x) => Math.round(x * 1000) / 1000 === x))
    && limpio.pose.reps[0].rodilla === 85 && limpio.pose.reps[0].tronco === 180 && A.analisisValido(limpio, 61) && A.limpiarAnalisis({}) === null && !('reps' in A.limpiarAnalisis({ pose: { lado: 'izq', reps: [{ t: [0, 1], rodilla: 90 }] }, reps: [{ t: [0, 1, 2] }] })),
    `lo que se guarda: 1801 puntos de 60 s quedan en ${limpio.barra.p.length} con 3 decimales; la pose, solo por repetición; vale para la base`);
  const sql36 = readFileSync(new URL('../supabase/migraciones/036_videos_analisis.sql', import.meta.url), 'utf8');
  check(/n > 900/.test(sql36) && /n > 30/.test(sql36) && /65536/.test(sql36) && A.MAX_PUNTOS_BARRA === 900 && A.MAX_REPS === 30 && A.MAX_BYTES_ANALISIS === 65536 && /'izq', 'der'/.test(sql36) && /0, 150/.test(sql36) && /0, 3\)/.test(sql36) && /10, 60/.test(sql36),
    'los mismos topes que la base: 900 puntos, 30 repeticiones, 64 kB, 0–3 m/s, 0–150 cm, discos de 10 a 60 cm');
  check(igual(A.serieVelocidad([{ fecha: '2026-10-02', revision: { analisis: { reps: [{ vm: 0.6 }, { vm: 0.7 }] } } }, { fecha: '2026-10-01', revision: { analisis: { reps: [{ vm: 0.5 }] } } }, { fecha: '2026-10-02', revision: { analisis: { reps: [{ vm: 0.65 }] } } }, { fecha: '2026-10-03', revision: null }]),
    [{ x: '2026-10-01', y: 0.5 }, { x: '2026-10-02', y: 0.7 }]), '«Mi técnica»: la mejor velocidad media de cada día, en orden');
  // Privacidad, rendimiento y lo que no se toca
  const legal = await import('../web/src/legal.js');
  const filaV = legal.PRIVACIDAD.find(([t]) => t === 'Tus vídeos de técnica')?.[1] || '';
  check(/análisis automático/.test(filaV) && /experimental/i.test(filaV) && /no sale/.test(filaV), 'la privacidad cuenta el análisis (experimental, hecho en el dispositivo, lo que se guarda)');
  // Revisión de seguridad de la v0.58
  // M1: la política cambia (2026-12) y avisa una vez con sus novedades: las de la v0.57 y la v0.58 juntas
  {
    const PV2 = await import('../web/src/logica/privacidad.js');
    const nueva = PV2.NOVEDADES_PRIVACIDAD.filter((x) => x[3] === '2026-12');
    const t = nueva.map((x) => x[2]).join(' ');
    check(legal.VERSION_LEGAL.startsWith('2026-12') && nueva.length === 1 && /nota de técnica \(de 1 a 5\)/.test(t) && /puntos clave/.test(t) && /tempo/.test(t) && /su voz sobre el vídeo/.test(t) && /solo el día/.test(t)
      && /experimental/.test(t) && /trayectoria de la barra/.test(t) && /velocidad estimada/.test(t) && /ángulos/.test(t) && /en el móvil u ordenador/.test(t) && /resumen de cada repetición/.test(t) && /nunca se guardan/.test(t),
      '(M1) la política pasa a la 2026-12 con una novedad, corta: la corrección (nota 1–5, puntos clave, tempo, voz), solo el día, el análisis en el dispositivo y que solo se guarda el resumen (nunca los puntos del cuerpo)');
    check(PV2.debeAvisarPrivacidad('2026-11', legal.VERSION_LEGAL) && PV2.novedadesDesde('2026-11', '2026-12').map((x) => x[1]).join() === 'Vídeos de técnica' && PV2.novedadesDesde(null, '2026-12').length === 5 && PV2.novedadesDesde(null, '2026-12.1').length === 6
      && PV2.novedadesDesde('2026-12', '2026-12').length === 0 && PV2.novedadesDesde('2026-10', '2026-11').length === 4,
      '(M1) quien vio la 2026-11 ve solo lo nuevo (los vídeos); quien no vio ninguna, todo');
    check(/Vio la política de 2026-11; la vigente es la 2026-12/.test(PV2.textoPrivacidadVista({ version: '2026-11' }, '2026-12')) && /vigente \(2026-12\)/.test(PV2.textoPrivacidadVista({ version: '2026-12' }, '2026-12'))
      && /novedadesDesde\(vista, actual\)/.test(readFileSync(new URL('../web/src/ui/AvisoPrivacidad.jsx', import.meta.url), 'utf8')), '(M1) el coach ve en «Datos» qué versión ha visto cada atleta; el aviso enseña las que le faltan');
  }
  // M2: lo analizado se olvida al salir (o al caducar la sesión) y, como mucho, el de los 5 últimos vídeos
  {
    const C = await import('../web/src/ui/tecnica/capas.js');
    for (let i = 1; i <= 7; i++) C.guardarSesionAnalisis(`u1:v${i}`, { barra: { puntos: [[i, 0.5, 0.5]] } });
    C.leerSesionAnalisis('u1:v3');
    C.guardarSesionAnalisis('u1:v8', {});
    check(C.MAX_SESION_ANALISIS === 5 && C.sesionesAnalisis().join() === 'u1:v5,u1:v6,u1:v7,u1:v3,u1:v8' && C.leerSesionAnalisis('u1:v1') === null, '(M2) lo analizado en la sesión: los 5 últimos vídeos (el que se vuelve a abrir pasa a ser el último)');
    C.ponerCapa('v3', () => null);
    check(typeof C.capaDe('v3') === 'function', '(M2) una capa puesta sobre un vídeo');
    C.olvidarAnalisis();
    check(!C.sesionesAnalisis().length && C.capaDe('v3') === null, '(M2) olvidarAnalisis(): fuera lo de la sesión y las capas sobre los vídeos');
    const app = readFileSync(new URL('../web/src/ui/App.jsx', import.meta.url), 'utf8');
    check((app.match(/borrarCacheChat\(\)\.catch\(\(\) => \{\}\); olvidarAnalisis\(\);/g) || []).length === 2 && !/new Map\(\)/.test(readFileSync(new URL('../web/src/ui/tecnica/analisis/PanelAnalisis.jsx', import.meta.url), 'utf8')),
      '(M2) se llama al salir y cuando la sesión se acaba sola (donde se borra la copia del chat); el panel no guarda nada por su cuenta');
  }
  // L2: los números, con 4 decimales como mucho (como la base)
  {
    const A2 = await import('../web/src/logica/analisis.js');
    check(A2.decimales(0.1234) === 4 && A2.decimales(1e-7) === 7 && A2.decimales(0.0015) === 4 && A2.decimales(1.5e-5) === 6 && A2.decimales(150) === 0 && A2.decimales(1e21) === 0 && A2.decimales(-2.25) === 2
      && !A2.analisisValido({ v: 1, barra: { p: [[0, 0.12345, 0.5], [0.1, 0.5, 0.5]] } }) && A2.analisisValido({ v: 1, barra: { p: [[0, 0.1234, 0.5], [0.1, 0.5, 0.5]] } }),
      '(L2) los decimales de un número tal como se envía (también con exponente): hasta 4 valen, como en la base');
  }
  // L1 y L4: la caché del modelo y lo que no se precarga
  {
    const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
    const sw = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
    check(/soloDemo\(f\)/.test(build) && /video\(-barra\)\?-demo-/.test(build) && /__MODELO_DIR__/.test(build) && /__MODELO_ARCHIVOS__/.test(build) && /claveModelo\(url\)/.test(sw) && !/pathname\.includes\('\/modelos\/'\)/.test(sw) && /TIPO_MODELO\.test/.test(sw),
      '(L1, L4) el service worker guarda solo los archivos del modelo (su carpeta, sin «?…», con su tipo) y no precarga los vídeos de la demo');
  }
  const srcA = (f) => readFileSync(new URL(`../web/src/ui/${f}`, import.meta.url), 'utf8');
  const todo = ['tecnica/Analisis.jsx', 'tecnica/capas.js', 'tecnica/analisis/PanelAnalisis.jsx', 'tecnica/analisis/Capas.jsx', 'tecnica/analisis/procesar.js', 'tecnica/analisis/pose.js', 'tecnica/analisis/seguidor.worker.js'].map(srcA).join('\n');
  check(!/preact\/compat/.test(todo) && !/https?:\/\/(?!www\.)/.test(srcA('tecnica/analisis/pose.js') + srcA('tecnica/analisis/procesar.js')) && /terminate\(\)/.test(todo) && /bmp\.close\(\)/.test(todo) && /pose\.close\(\)/.test(todo) && /import\('\.\/analisis\/PanelAnalisis\.jsx'\)/.test(srcA('tecnica/Analisis.jsx'))
    && !/from '\.\/analisis\//.test(srcA('tecnica/Analisis.jsx')), 'sin preact/compat; nada de fuera (ni CDN); se sueltan el worker, las imágenes y el modelo; el panel se carga solo al usarlo');
  const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  check(/!f\.startsWith\('modelos\/'\)/.test(build) && /pose_landmark_lite\.tflite/.test(build) && !/pose_landmark_(full|heavy)/.test(build) && /script-src 'self' 'wasm-unsafe-eval';/.test(html) && !/script-src[^;]*https?:/.test(html)
    && /modelos\//.test(sw) && /fbe-modelos-/.test(sw), 'el modelo (solo el «lite») va en la app, no se precarga al instalar y se guarda al usarlo; la CSP deja compilar wasm, sin scripts de fuera');
}

console.log('\nv0.59: los vídeos de técnica, tanda A (recorte automático, repeticiones, cola, frases, recordatorios, valoración)');
{
  const MV = await import('../web/src/logica/movimiento.js');
  const RP = await import('../web/src/logica/repeticiones.js');
  const CO = await import('../web/src/logica/correccion.js');
  // 10. El recorte automático, con fotogramas inventados: 5 por segundo, 8×8 píxeles; quieto, se mueve y quieto
  const fps = 5, px = 64;
  let semilla = 7;
  const ruido = () => { semilla = (semilla * 16807) % 2147483647; return (semilla % 3) - 1; };
  const fotograma = (t, mueve) => Uint8Array.from({ length: px }, (_, k) => Math.max(0, Math.min(255, 100 + ruido() + (mueve ? Math.round(80 * Math.sin(t * 9 + k)) : 0))));
  const clip = (dur, ini, fin) => { const { tiempos } = MV.tiemposMuestreo(dur); return { tiempos, frames: tiempos.map((t) => fotograma(t, t >= ini && t <= fin)) }; };
  const c1 = clip(10, 3, 6);
  const d1 = MV.detectarMovimiento(c1.frames, { tiempos: c1.tiempos, dur: 10 });
  check(d1 && Math.abs(d1.inicio - 3) <= 0.4 && Math.abs(d1.fin - 6) <= 0.4 && Math.abs(d1.desde - (d1.inicio - 1)) < 0.01 && Math.abs(d1.hasta - (d1.fin + 1)) < 0.01 && MV.recorteUtil(d1, 10),
    `(10) quieto 3 s, se mueve hasta el 6 y quieto: propone de ${d1?.desde} a ${d1?.hasta} (el movimiento, con 1 s de margen)`);
  const c2 = clip(6, 0, 6);
  check(MV.detectarMovimiento(c2.frames, { tiempos: c2.tiempos, dur: 6 }) === null, 'moviéndose todo el rato igual: nada que proponer');
  const c3 = clip(6, 99, 99);
  check(MV.detectarMovimiento(c3.frames, { tiempos: c3.tiempos, dur: 6 }) === null, 'quieto (solo ruido del sensor): nada');
  // Un golpe suelto (un fotograma) no cuenta; una pausa corta dentro de la serie no la parte
  const c4 = (() => { const { tiempos } = MV.tiemposMuestreo(12); return { tiempos, frames: tiempos.map((t) => fotograma(t, (t >= 1 && t <= 1.2) || (t >= 4 && t <= 6) || (t >= 6.8 && t <= 8))) }; })();
  const d4 = MV.detectarMovimiento(c4.frames, { tiempos: c4.tiempos, dur: 12 });
  check(d4 && Math.abs(d4.inicio - 4) <= 0.4 && Math.abs(d4.fin - 8) <= 0.4, `un golpe suelto al principio no cuenta y una pausa de 0,8 s no parte la serie (${d4?.inicio}–${d4?.fin})`);
  const c5 = clip(10, 0.2, 9.5);
  const d5 = MV.detectarMovimiento(c5.frames, { tiempos: c5.tiempos, dur: 10 });
  check(d5 && d5.desde === 0 && d5.hasta === 10 && !MV.recorteUtil(d5, 10), 'si se mueve casi todo el vídeo, el margen no se sale (de 0 a 10) y no se propone recortar');
  check(!MV.recorteUtil({ desde: 0.5, hasta: 3.2 }, 3.5) && MV.detectarMovimiento([], {}) === null && MV.detectarMovimiento([fotograma(0, false)], {}) === null, 'en un vídeo de menos de 4 s, o sin fotogramas, nada');
  const m30 = MV.tiemposMuestreo(30), m120 = MV.tiemposMuestreo(120);
  check(m30.tiempos.length === 151 && Math.abs(m30.fps - 5) < 0.01 && m120.tiempos.length <= 301 && m120.tiempos.at(-1) === 120 && m120.fps < 5 && MV.tiemposMuestreo(0).tiempos.length === 0,
    'a 5 fotogramas por segundo (en uno largo, menos: como mucho 300), del principio al final');
  check(igual(MV.tamMuestra(1080, 1920), { w: 90, h: 160 }) && igual(MV.tamMuestra(100, 50), { w: 100, h: 50 }) && igual(MV.tamMuestra(0, 0), { w: 0, h: 0 }), 'a 160 px como mucho (el lado largo)');
  check(igual(MV.diferencias([[0, 0], [10, 20], [10, 20]]), [15, 0]), 'la diferencia media entre fotogramas');
  // 19. La tira
  check(MV.momentosTira(3).length === 12 && MV.momentosTira(8).length === 16 && MV.momentosTira(60).length === 20 && Math.abs(MV.momentosTira(4)[0] - 4 / 24) < 0.001,
    '(19) la tira: de 12 a 20 miniaturas (dos por segundo), cada una en el centro de su trozo');
  check(MV.tiraDisponible({ dur: 3 }) && !MV.tiraDisponible({ dur: 2 }) && !MV.tiraDisponible({ dur: 10, memoria: 1 }) && MV.tiraDisponible({ dur: 10, memoria: 4 }) && !MV.tiraDisponible({ dur: NaN }),
    'ni en un vídeo muy corto ni en un móvil con poca memoria');
  check(MV.momentoEnTira(0.5, 8) === 4 && MV.momentoEnTira(-1, 8) === 0 && MV.momentoEnTira(2, 8) === 8 && MV.indiceTira([0.5, 1.5, 2.5], 1.4) === 1 && MV.indiceTira([], 1) === -1, 'tocar en la tira lleva a su momento; el teclado, de miniatura en miniatura');
  // 15. Las repeticiones
  const analisis = { v: 1, barra: { p: [[0, 0.5, 0.5], [6, 0.5, 0.5]] }, reps: [{ t: [0.4, 1.1, 1.9], vm: 1.0 }, { t: [2.3, 3.0, 3.9], vm: 0.89 }, { t: [4.3, 5.0, 6.05], vm: 0.76 }] };
  const ra = RP.marcasRepeticiones({ analisis, tempo: { reps: [[0, 1, 2]] }, manual: [0.5], duracion: 6.1 });
  check(ra.fuente === 'analisis' && igual(ra.reps.map((r) => [r.n, r.t]), [[1, 0.4], [2, 2.3], [3, 4.3]]), '(15) del análisis guardado antes que del tempo o de las marcas a mano');
  check(RP.marcasRepeticiones({ sesion: [{ t: [1, 2, 3], vm: 0.5 }], analisis }).fuente === 'sesion' && RP.marcasRepeticiones({ tempo: { reps: [[0.2, 1, 2], [2.5, 3, 4]] } }).reps.length === 2
    && RP.marcasRepeticiones({ manual: { t: [3, 1, 2] } }).reps.map((r) => r.t).join() === '1,2,3' && RP.marcasRepeticiones({}).fuente === null
    && RP.marcasRepeticiones({ analisis: { pose: { lado: 'izq', reps: [{ t: [0.5, 2], rodilla: 80 }, { t: [2.5, 4], rodilla: 95 }] } } }).reps.length === 2,
    'el de esta sesión antes que el guardado; si no, el tempo, las marcas a mano o las de la pose');
  check(RP.marcasRepeticiones({ tempo: { reps: [[0.2, 1, 2], [9, 10, 11]] }, duracion: 5 }).reps.length === 1, 'las de fuera del vídeo, no');
  const p1 = RP.peorRepeticion({ reps: ra.reps });
  check(p1?.motivo === 'velocidad' && p1.t === 4.3 && /0,76 m\/s, −24 %/.test(p1.texto) && RP.indicePeor(ra.reps, p1) === 2, `«la peor»: la más lenta (${p1?.texto})`);
  const pose = { reps: [{ t: [0.5, 2], rodilla: 80, tronco: 30 }, { t: [2.5, 4], rodilla: 97, tronco: 41 }, { t: [4.5, 6], rodilla: 85 }] };
  const p2 = RP.peorRepeticion({ reps: [], pose });
  check(p2?.motivo === 'profundidad' && p2.t === 2.5 && /97°/.test(p2.texto), 'sin velocidad, con la pose: la menos profunda');
  check(RP.peorRepeticion({ pose: { reps: [{ t: [0, 1], tronco: 20 }, { t: [1, 2], tronco: 35 }] } })?.motivo === 'tronco' && RP.peorRepeticion({ reps: [{ t: 0, vm: 0.5 }] }) === null
    && RP.peorRepeticion({ reps: [{ t: 0, vm: 0.5 }, { t: 1, vm: 0.5 }] }) === null && RP.peorRepeticion({}) === null, 'o la del tronco más inclinado; con una sola (o todas iguales), ninguna');
  const marcasT = RP.marcasRepeticiones({ tempo: { reps: [[0.2, 1, 2], [2.4, 3, 4]] } }).reps;
  check(RP.indicePeor(marcasT, { t: 2.6 }) === 1 && RP.indicePeor(marcasT, { t: 9 }) === 1 && RP.indicePeor([], { t: 1 }) === -1, 'la peor se busca entre las marcas por su momento');
  check(RP.repVecina(ra.reps, 0, 1).n === 1 && RP.repVecina(ra.reps, 2.3, 1).n === 3 && RP.repVecina(ra.reps, 2.3, -1).n === 1 && RP.repVecina(ra.reps, 0.2, -1) === null && RP.repActual(ra.reps, 3) === 1 && RP.repActual(ra.reps, 0.1) === -1,
    '[ y ]: a la anterior y a la siguiente; en cuál está el vídeo');
  check(igual(RP.anadirRepManual([1, 3], 2), [1, 2, 3]) && igual(RP.anadirRepManual([1], 1.1), [1]) && RP.anadirRepManual(Array.from({ length: 30 }, (_, i) => i), 40).length === 30 && igual(RP.quitarRepManual([1, 2], 2), [1]),
    '«Marcar rep»: en orden, sin dos casi iguales y como mucho 30');
  // El validador de las marcas a mano (como reps_manual_validas)
  check(RP.repsManualValidas({ t: [0, 1.5, 3] }) && RP.repsManualValidas({ t: [1] }, 1) && !RP.repsManualValidas({ t: [0, 3] }, 1) && [null, {}, [], { t: [] }, { t: [2, 1] }, { t: [1, 1] }, { t: ['1'] }, { t: [-1] }, { t: [3601] }, { t: [0.12345] }, { t: [1], x: 1 }, { t: Array(31).fill(0).map((_, i) => i) }, { t: [NaN] }]
    .every((x) => !RP.repsManualValidas(x)), 'las marcas a mano: en orden, de 0 a 3600 s (y dentro del vídeo), 4 decimales como mucho; lo mal formado, no');
  // 18. La cola
  const H = 3600000, ahora = Date.parse('2026-11-04T12:00:00Z');
  check(CO.textoEspera(26.4) === 'hace 26 h' && CO.textoEspera(0.5) === 'hace menos de 1 h' && CO.textoEspera(80) === 'hace 3 días' && CO.horasEsperando(new Date(ahora - 5 * H).toISOString(), ahora) === 5 && CO.horasEsperando(null) === null,
    '(18) cuánto lleva esperando: «hace 26 h» (y, pasados 3 días, en días)');
  check(CO.nivelEspera(10, 24) === 'ok' && CO.nivelEspera(13, 24) === 'aviso' && CO.nivelEspera(25, 24) === 'alerta' && CO.nivelEspera(25, 48) === 'aviso' && CO.nivelEspera(23, 48) === 'ok' && CO.nivelEspera(30, 7) === 'alerta' && CO.nivelEspera(null) === null,
    'con el objetivo (24 o 48 h): a tiempo hasta la mitad, cerca hasta el objetivo, pasado después');
  const iso = (h) => new Date(ahora - h * H).toISOString();
  const vids = [
    { creado_en: iso(50), revisado_en: iso(40) },          // 10 h
    { creado_en: iso(30), revisado_en: iso(26), corregido_en: iso(28) }, // 2 h (lo primero)
    { creado_en: iso(100), corregido_en: iso(70) },        // 30 h
    { creado_en: iso(24 * 40), revisado_en: iso(24 * 35) }, // fuera de los 30 días
    { creado_en: iso(20) },                                 // espera 20 h
    { creado_en: iso(5) },                                  // espera 5 h
  ];
  const est = CO.estadisticasRevision(vids, { ahora, desdeSemana: ahora - 45 * H });
  check(est.n30 === 3 && est.mediana === 10 && est.p90 === 30 && est.semana === 2 && est.pendientes === 2 && est.masAntiguo === 20, `la mediana (${est.mediana} h) y el p90 (${est.p90} h) de 30 días, los de esta semana y el que más espera`);
  check(igual(CO.estadisticasRevision([], { ahora }), { n30: 0, mediana: null, p90: null, semana: 0, pendientes: 0, masAntiguo: null }) && CO.estadisticasRevision([{ creado_en: 'no' }], { ahora }).pendientes === 0, 'sin vídeos, sin datos');
  check(new Date(CO.inicioSemana(Date.parse('2026-11-04T12:00:00'))).getDay() === 1 && new Date(CO.inicioSemana(Date.parse('2026-11-08T23:00:00'))).getDate() === 2, 'esta semana: desde el lunes a las 0:00');
  const items = [{ x: 1, a: { creado_en: iso(2) } }, { x: 2 }, { x: 3, a: { creado_en: iso(30) } }];
  check(igual(CO.ordenarPorEspera(items).map((i) => i.x), [3, 1, 2]), 'por más tiempo esperando (lo que no es un vídeo, detrás)');
  const grupos = [{ id: 'a', items: [{ x: 1, a: { creado_en: iso(3) } }] }, { id: 'b', items: [{ x: 2 }, { x: 3, a: { creado_en: iso(40) } }] }, { id: 'c', items: [{ x: 4 }] }];
  check(igual(CO.ordenarGruposPorEspera(grupos).map((g) => g.id), ['b', 'a', 'c']) && igual(CO.ordenarGruposPorEspera(grupos)[0].items.map((i) => i.x), [3, 2]), 'y los atletas, por su vídeo que más espera');
  check(CO.textoHoras(26) === '26 h' && CO.textoHoras(2.5) === '2,5 h' && CO.textoHoras(0.25) === '15 min' && CO.textoHoras(96) === '4 días' && CO.textoHoras(null) === '—', 'las horas, en palabras');
  // 4. Las frases
  check(CO.insertarFrase('', 'Rodillas fuera', { momento: '0:04,2' }) === '0:04,2 Rodillas fuera' && CO.insertarFrase('Bien', 'Rodillas fuera', { momento: '0:04,2' }) === 'Bien\n0:04,2 Rodillas fuera'
    && CO.insertarFrase('Bien\n0:04,2 ', 'Rodillas fuera', { momento: '0:04,2' }) === 'Bien\n0:04,2 Rodillas fuera' && CO.insertarFrase('0:01 Rodillas fuera', 'Rodillas  fuera ', { momento: '0:02' }) === '0:01 Rodillas fuera'
    && CO.insertarFrase('Hola', '   ') === 'Hola' && CO.insertarFrase('Hola', 'Sin momento') === 'Hola\nSin momento',
    '(4) la frase va al comentario en una línea nueva, con el momento del vídeo delante (sin repetirse)');
  const dib = { t: 0, hasta: 1.5, formas: [{ tipo: 'flecha', p: [[0.2, 0.2], [0.5, 0.5]] }] };
  const enT = CO.dibujoEnMomento(dib, 4.2);
  check(enT.t === 4.2 && enT.hasta === 5.7 && enT.formas.length === 1 && CO.dibujoEnMomento({ t: 0, formas: [] }, 3) === null && CO.dibujoEnMomento(dib, 4.2, { t: 4.2, formas: [{ tipo: 'linea', p: [[0, 0], [1, 1]] }] }).formas.length === 2,
    'su dibujo, en el momento en que está el vídeo (con su tramo), junto al que ya había en ese momento');
  check(igual(CO.dibujoParaFrase({ t: 3, hasta: 4, formas: dib.formas }), { t: 0, formas: dib.formas, hasta: 1 }) && CO.dibujoParaFrase(null) === null, 'un dibujo se guarda en una frase desde el 0');
  check(CO.frasesSugeridas('Sentadilla trasera', ['cuadriceps']).length >= 3 && CO.frasesSugeridas('Press banca', ['pectoral']).some((t) => /Escápulas/.test(t)) && CO.frasesSugeridas('Hip thrust con barra').some((t) => /Tibias/.test(t))
    && CO.frasesSugeridas('Ejercicio raro').length >= 2 && CO.frasesSugeridas('Peso muerto rumano', ['isquiotibiales']).every((t) => [...t].length <= 140), 'las sugeridas de los básicos (neutras, de hasta 140 letras)');
  check(CO.fraseValida({ texto: 'Bien', dibujo: dib }) && !CO.fraseValida({ texto: '' }) && !CO.fraseValida({ texto: 'x'.repeat(141) }) && !CO.fraseValida({ texto: 'Bien', dibujo: { t: 0, formas: [] } }) && !CO.fraseValida({ texto: '​' }) && !CO.fraseValida(null),
    'una frase válida: de 1 a 140 letras visibles y, si lleva dibujo, uno válido');
  const fr = CO.frasesPara([{ id: 1, ejercicio_id: null, orden: 0 }, { id: 2, ejercicio_id: 'e', orden: 2 }, { id: 3, ejercicio_id: 'e', orden: 1 }, { id: 4, ejercicio_id: 'otro' }], 'e');
  check(igual(fr.map((f) => f.id), [3, 2, 1]), 'las del ejercicio primero (en su orden) y luego las de todos; las de otro, no');
  // 14. Los recordatorios
  check(CO.limpiarTextoRecordatorio('  Rodillas   fuera ') === 'Rodillas fuera' && [...CO.limpiarTextoRecordatorio('x'.repeat(200))].length === 140 && CO.limpiarTextoRecordatorio('x'.repeat(200)).endsWith('…')
    && CO.recordatorioValido({ texto: 'Bien', archivo_id: 'v', segundo: 2 }) && !CO.recordatorioValido({ texto: 'Bien', segundo: 2 }) && !CO.recordatorioValido({ texto: '' }) && !CO.recordatorioValido({ texto: 'x', archivo_id: 'v', segundo: 3601 }),
    '(14) un recordatorio: de 1 a 140 letras; su momento, solo con su vídeo');
  const diario = [
    { id: 'v1', tipo: 'video_tecnica', ejercicio: { id: 'e' }, fecha: '2026-10-01', revision: { corregido_el: '2026-10-02', checklist: { puntos: [{ t: 'Rodillas fuera', e: 'mal', s: 1.5 }, { t: 'Pies', e: 'bien' }] } } },
    { id: 'v2', tipo: 'video_tecnica', ejercicio: { id: 'e' }, fecha: '2026-10-20', revision: { corregido_el: '2026-10-21', checklist: { puntos: [{ t: 'Pecho arriba', e: 'mal' }, { t: 'Rodillas fuera', e: 'mal', s: 2 }] } } },
    { id: 'v3', tipo: 'video_tecnica', ejercicio: { id: 'e' }, fecha: '2026-10-25', revision: null },
  ];
  const sug = CO.sugerenciasRecordatorio(diario, 'e', [{ texto: 'rodillas fuera' }]);
  check(sug.length === 1 && sug[0].texto === 'Pecho arriba' && sug[0].archivoId === 'v2' && sug[0].segundo === null && CO.sugerenciasRecordatorio(diario, 'otro').length === 0 && CO.sugerenciasRecordatorio(diario, null).length === 0,
    'lo que se propone fijar: los ✗ del último vídeo corregido de ese ejercicio, sin los que ya son recordatorios');
  check(igual(Object.keys(CO.recordatoriosPorEjercicio([{ ejercicio_id: 'a' }, { ejercicio_id: 'a' }, { ejercicio_id: 'b' }, { ejercicio_id: 'a' }, { ejercicio_id: 'a' }])), ['a', 'b'])
    && CO.recordatoriosPorEjercicio([{ ejercicio_id: 'a' }, { ejercicio_id: 'a' }, { ejercicio_id: 'a' }, { ejercicio_id: 'a' }]).a.length === 3 && CO.claveEntendido('x', '2026-11-04') === 'fbe-recuerda-x-2026-11-04',
    'por ejercicio, como mucho 3; «Entendido», por día');
  // 12. La valoración del atleta
  check(igual(CO.limpiarAutoevaluacion({ rpe: '8.5', nota: '  Me cuesta  ', molestia: true, zona: 'rodilla' }, { salud: true }), { rpe: 8.5, nota: 'Me cuesta', molestia: true, zona: 'rodilla' })
    && igual(CO.limpiarAutoevaluacion({ rpe: 9, molestia: true, zona: 'rodilla' }, { salud: false }), { rpe: 9, nota: null, molestia: null, zona: null })
    && CO.limpiarAutoevaluacion({ molestia: true }, { salud: false }) === null && CO.limpiarAutoevaluacion({}) === null && CO.limpiarAutoevaluacion({ rpe: 8.3 }) === null
    && igual(CO.limpiarAutoevaluacion({ molestia: false, zona: 'rodilla' }, { salud: true }), { rpe: null, nota: null, molestia: false, zona: null }),
    '(12) la valoración: sin consentimiento de salud, nada de la molestia; la zona, solo con molestia; el RPE, de 6 a 10 de medio en medio');
  check(CO.autoevaluacionValida({ rpe: 6 }) && CO.autoevaluacionValida({ nota: 'x' }) && CO.autoevaluacionValida({ molestia: false }) && [null, {}, { rpe: 5.5 }, { rpe: 10.5 }, { rpe: 7.25 }, { nota: '' }, { nota: 'x'.repeat(281) }, { molestia: 'si' }, { molestia: false, zona: 'rodilla' }, { molestia: true, zona: 'pie' }, { nota: '​' }]
    .every((x) => !CO.autoevaluacionValida(x)), 'como la restricción de la base (lo mal formado, no)');
  const txt = CO.textoAutoevaluacion({ rpe: 8.5, nota: 'Rodillas', molestia: true, zona: 'zona_lumbar' }, 'Ana López');
  check(txt.titulo === 'Ana nota:' && txt.rpe === 'RPE 8,5' && txt.molestia === 'Molestia: zona lumbar' && CO.textoAutoevaluacion({ molestia: false }).molestia === 'Sin molestias' && CO.textoAutoevaluacion(null) === null,
    'para el coach: «Ana nota: …», su RPE y si nota molestias');
  check(CO.compararAutoevaluacion({ rpe: 9.5 }, 2).lectura?.includes('bajar la carga') && CO.compararAutoevaluacion({ rpe: 7 }, 4).lectura?.includes('margen') && CO.compararAutoevaluacion({ rpe: 8 }, 3).texto === 'su esfuerzo, RPE 8 · tu nota de técnica, 3/5'
    && CO.compararAutoevaluacion(null, null) === null && CO.compararAutoevaluacion(null, 4).texto === 'tu nota de técnica, 4/5', 'su esfuerzo junto a tu nota de técnica');
  // 7. Su mejor
  const vs = [
    { id: 'a', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-09-01', revision: { corregido_el: '2026-09-02', puntuacion: 4 } },
    { id: 'b', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-10-01', revision: { corregido_el: '2026-10-02', puntuacion: 4, analisis: { reps: [{ vm: 0.8 }, { vm: 0.9 }] } } },
    { id: 'c', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-10-10', revision: { corregido_el: '2026-10-11', puntuacion: 3, analisis: { reps: [{ vm: 1.2 }] } } },
    { id: 'd', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-11-01', revision: null },
    { id: 'f', tipo: 'video_tecnica', atleta_id: 'y', ejercicio: { id: 'e' }, fecha: '2026-11-01', revision: { corregido_el: '2026-11-01', puntuacion: 5 } },
    { id: 'g', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'otro' }, fecha: '2026-11-01', revision: { corregido_el: '2026-11-01', puntuacion: 5 } },
  ];
  check(CO.mejorVideo(vs, vs[3])?.id === 'b' && CO.mejorVideo(vs, vs[1])?.id === 'a' && CO.mejorVideo(vs.slice(2, 4), vs[3])?.id === 'c' && CO.mejorVideo(vs, { id: 'z', ejercicio: null }) === null && CO.mejorVideo([], vs[0]) === null,
    '(7) su mejor: la mejor nota, después la mejor velocidad guardada, después el más reciente; del mismo atleta y ejercicio, y ya corregido');
  check(CO.mejorVideo([{ id: 'h', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-01-01', revision: { corregido_el: '2026-01-02' } }, { id: 'i', tipo: 'video_tecnica', atleta_id: 'x', ejercicio: { id: 'e' }, fecha: '2026-02-01', revision: { corregido_el: '2026-02-02' } }], vs[3])?.id === 'i'
    && CO.velocidadMaxima({ reps: [{ vm: 0.5 }, { vm: 0.7 }, {}] }) === 0.7 && CO.velocidadMaxima(null) === null && CO.porQueMejor(vs[1]) === 'nota 4/5 · 0,9 m/s', 'sin nota ni velocidad, el más reciente; y por qué es el mejor');
  // Sin preact/compat y las cachés de la sesión se olvidan al salir
  const srcV = (f) => readFileSync(new URL(`../web/src/ui/${f}`, import.meta.url), 'utf8');
  const todo59 = ['tecnica/Tira.jsx', 'tecnica/Recordatorios.jsx', 'tecnica/Frases.jsx', 'tecnica/Modelos.jsx', 'tecnica/Autoevaluacion.jsx', 'Video.jsx', 'Archivos.jsx', 'recorte.js'].map(srcV).join('\n');
  check(!/preact\/compat/.test(todo59) && (srcV('App.jsx').match(/olvidarAnalisis\(\); olvidarTiras\(\);/g) || []).length === 2, 'sin preact/compat; la tira de miniaturas se olvida al cerrar la sesión (como el análisis)');
  // (revisión de la v0.59) M2: la política 2026-12.1, comparada por partes (nunca como texto)
  {
    const PV = await import('../web/src/logica/privacidad.js');
    const orden = ['2025-12', '2026-01', '2026-11', '2026-12', '2026-12.1', '2026-12.2', '2026-12.9', '2027-01', '2027-01.1'];
    let bien = true;
    for (let i = 0; i < orden.length; i++) for (let j = 0; j < orden.length; j++) if (PV.compararVersiones(orden[i], orden[j]) !== Math.sign(i - j)) bien = false;
    check(bien && PV.compararVersiones('2026-12', 'x') === null && PV.compararVersiones(null, '2026-12') === null, `se ordenan por partes: ${orden.join(' < ')}`);
    check(PV.formatoVersion('2026-12.1') && PV.formatoVersion('2026-12.9') && !PV.formatoVersion('2026-12.0') && !PV.formatoVersion('2026-12.10') && !PV.formatoVersion('2026-12.') && !PV.formatoVersion('2026-12-1') && !PV.formatoVersion('2026-13.1')
      && PV.versionSinRevision('2026-12.1') === '2026-12' && PV.versionSinRevision('2026-12') === '2026-12' && PV.versionSinRevision('x') === null,
      'el formato: «AAAA-MM» o «AAAA-MM.n» (de 1 a 9); sin la revisión, la del mes');
    check(PV.debeAvisarPrivacidad('2026-12', '2026-12.1') && !PV.debeAvisarPrivacidad('2026-12.1', '2026-12.1') && !PV.debeAvisarPrivacidad('2026-12.1', '2026-12') && !PV.debeAvisarPrivacidad('2027-01', '2026-12.1')
      && PV.debeAvisarPrivacidad('2026-11', '2026-12.1') && PV.versionMayor('2026-12.1', '2026-12') === '2026-12.1' && PV.versionMayor('2026-12', '2026-12.1') === '2026-12.1' && PV.versionMayor('2027-01', '2026-12.2') === '2027-01',
      'quien vio la 2026-12 ve el aviso de la 2026-12.1; quien vio esa (o una posterior), no; sin la 037 (2026-12), nadie lo vuelve a ver');
    const n121 = PV.novedadesDesde('2026-12', '2026-12.1');
    check(n121.length === 1 && n121[0][3] === '2026-12.1' && /cómo lo has notado/.test(n121[0][2]) && /consentimiento de salud/.test(n121[0][2]) && /recordatorios/.test(n121[0][2]) && /vídeos modelo/.test(n121[0][2])
      && PV.novedadesDesde('2026-12.1', '2026-12.1').length === 0 && PV.novedadesDesde('2026-11', '2026-12.1').length === 2 && PV.novedadesDesde('2026-11', '2026-12').length === 1
      && !/cómo lo has notado|recordatorios|vídeos modelo/.test(PV.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12')[2]),
      'quien vio la 2026-12 ve solo lo de la 037 (cómo lo has notado, con la molestia y su consentimiento, recordatorios y vídeos modelo); la entrada de la 2026-12 queda como estaba');
    check(/vigente \(2026-12\.1\)/.test(PV.textoPrivacidadVista({ version: '2026-12.1' }, '2026-12.1')) && /Vio la política de 2026-12; la vigente es la 2026-12\.1/.test(PV.textoPrivacidadVista({ version: '2026-12' }, '2026-12.1'))
      && /vigente/.test(PV.textoPrivacidadVista({ version: '2027-01' }, '2026-12.1')) && /Ha visto la política de privacidad vigente/.test(PV.textoPrivacidadVista({ version: '2026-12.1' }, '2026-12')), 'el coach lo ve en la ficha, también con la revisión');
    const srcApi = readFileSync(new URL('../web/src/datos/api.js', import.meta.url), 'utf8');
    check(/async versionLegal\(\)/.test(srcApi) && /video037\(\)/.test(srcApi.slice(srcApi.indexOf('async versionLegal()'), srcApi.indexOf('async versionLegal()') + 400)) && !/version <= VERSION_LEGAL|local > enBase/.test(srcApi),
      'la app usa la 2026-12.1 solo si la base tiene la 037 (si no, la 2026-12, como antes); nada compara versiones como texto');
  }
  // L3: los «Entendido», solo de hoy (los demás se quitan al cargar y todos al salir)
  {
    const CO2 = await import('../web/src/logica/correccion.js');
    const ks = ['fbe-recuerda-a-2026-11-03', 'fbe-recuerda-b-2026-11-04', 'fbe-recuerda-c-2026-10-01', 'fbe-tema', 'otra-fbe-recuerda-x-2026-11-03', null];
    check(CO2.clavesEntendido(ks, '2026-11-04').join() === 'fbe-recuerda-a-2026-11-03,fbe-recuerda-c-2026-10-01' && CO2.clavesEntendido(ks).length === 3 && CO2.clavesEntendido(null).length === 0
      && CO2.claveEntendido('b', '2026-11-04') === 'fbe-recuerda-b-2026-11-04', 'al cargar se quitan los «Entendido» que no son de hoy; al salir, todos (y nada más)');
    const srcApp = readFileSync(new URL('../web/src/ui/App.jsx', import.meta.url), 'utf8');
    const srcEnt = readFileSync(new URL('../web/src/ui/tecnica/entendidos.js', import.meta.url), 'utf8');
    check((srcApp.match(/olvidarEntendidos\(\);/g) || []).length === 2 && /podarEntendidos\(\);/.test(srcApp) && /try \{/.test(srcEnt) && /catch/.test(srcEnt),
      'App los quita al salir y cuando la sesión caduca (con try/catch: sin almacenamiento, no pasa nada)');
  }
  // L2 y L5: la política dice qué se puede hacer con la valoración y qué pasa con la molestia al retirar el consentimiento
  {
    const legal2 = await import('../web/src/legal.js');
    const tv = legal2.PRIVACIDAD.find((x) => x[0] === 'Tus vídeos de técnica')[1];
    check(/cambiarlo hasta que tu coach revise el vídeo y borrarlo cuando quieras/.test(tv) && /Si retiras el consentimiento de datos de salud, ya no puedes contar molestias nuevas/.test(tv) && /no se borran solas/.test(tv)
      && /lo ya tratado sigue siendo lícito/.test(tv), 'cambiarla hasta que se revisa y borrarla cuando quiera; al retirar el consentimiento, no hay molestias nuevas y las contadas siguen (como lo demás ya tratado)');
  }
}

// v0.60: los vídeos de técnica, tanda B (primera mitad): el compositor (formato, topes, lo de encima en cada momento), la
// cara (la caja de la cabeza con los puntos del cuerpo y rellenar los fotogramas sin ella), dos ángulos y la cámara lenta
console.log('\nv0.60: el compositor, difuminar la cara, dos ángulos y la cámara lenta');
{
  const C = await import('../web/src/logica/composicion.js');
  const K = await import('../web/src/logica/cara.js');
  const A = await import('../web/src/logica/angulos.js');
  // El formato: MP4 si se sabe; si no, WebM (VP9 y luego VP8); con sonido, su códec; null si no hay ninguno
  const solo = (...ts) => (t) => ts.includes(t);
  check(C.elegirFormato(solo('video/mp4;codecs=avc1.42E01F', 'video/webm;codecs=vp9'))?.tipo === 'video/mp4' && C.elegirFormato(solo('video/webm;codecs=vp9', 'video/webm;codecs=vp8')).grabar === 'video/webm;codecs=vp9'
    && C.elegirFormato(solo('video/webm;codecs=vp8')).ext === 'webm' && C.elegirFormato(solo('video/webm')).tipo === 'video/webm', 'el formato: MP4 primero (Safari, Chrome reciente); si no, WebM VP9, VP8 o a secas');
  check(C.elegirFormato(solo('video/mp4;codecs=avc1.42E01F'), { audio: true }) === null && C.elegirFormato(solo('video/mp4;codecs=avc1,mp4a.40.2'), { audio: true }).grabar === 'video/mp4;codecs=avc1,mp4a.40.2'
    && C.elegirFormato(solo('video/mp4'), { audio: true }).tipo === 'video/mp4' && C.elegirFormato(solo('video/webm;codecs=vp9,opus'), { audio: true }).ext === 'webm',
    'con sonido (el micro, la voz del coach), uno que lo lleve (AAC u Opus); el de Safari, «video/mp4» a secas');
  check(C.elegirFormato(() => false) === null && C.elegirFormato(null) === null && C.elegirFormato(() => { throw new Error('x'); }) === null, 'sin ninguno (o si el navegador falla al preguntar), null: el botón no sale');
  check(C.tipoBase('video/webm;codecs=vp9,opus') === 'video/webm' && C.tipoRespuestaValido('video/mp4;codecs=avc1') && !C.tipoRespuestaValido('video/quicktime') && !C.tipoRespuestaValido(''), 'lo que se guarda: el tipo sin códecs (mp4 o webm)');
  // Los topes: 720p (múltiplos de 16, nunca más grande) y 3 minutos
  const m1 = C.medidasSalida(1080, 1920), m2 = C.medidasSalida(3840, 2160), m3 = C.medidasSalida(640, 360);
  check(m1.w === 720 && m1.h === 1280 && m2.w === 1280 && m2.h === 720 && m3.w === 640 && m3.h === 368 && [m1, m2, m3].every((m) => m.w % 16 === 0 && m.h % 16 === 0),
    `el tamaño: el lado corto a 720 y el largo a 1280 como mucho, en múltiplos de 16 (${m1.w}×${m1.h}, ${m2.w}×${m2.h}, ${m3.w}×${m3.h})`);
  check(C.MAX_SEG_REVISION === 180 && C.MAX_SEG_CARA === 60 && C.dentroDelTope(180) && !C.dentroDelTope(181) && !C.dentroDelTope(0) && C.dentroDelTope(60, C.MAX_SEG_CARA) && !C.dentroDelTope(61, C.MAX_SEG_CARA),
    'los topes: 3 minutos la revisión grabada y la exportación; 1 minuto la cámara de delante');
  check(C.duracionRespuesta(179.6, 'coach') === 180 && C.duracionRespuesta(500, 'coach') === 181 && C.duracionRespuesta(75, 'atleta') === 61 && C.duracionRespuesta(0.2) === 1, 'la duración que se guarda (como la 038: de 1 s al tope y un segundo de margen)');
  const enc = C.encajar(400, 400, 1920, 1080);
  check(enc.w === 400 && Math.round(enc.h) === 225 && Math.round(enc.y) === 88 && enc.x === 0, 'la imagen encajada en el lienzo (con bandas si no coincide la proporción)');
  // La burbuja: su esquina, al soltarla, la más cercana
  const bb = C.burbuja('abajo-der', 720, 1280), ba = C.burbuja('arriba-izq', 720, 1280);
  check(bb.d === 202 && bb.cx > 720 / 2 && bb.cy > 1280 / 2 && bb.cx + bb.d / 2 <= 720 && ba.cx - ba.d / 2 >= 0 && ba.cy - ba.d / 2 >= 0, 'la burbuja de la cámara de delante, en su esquina y dentro del lienzo');
  check(C.esquinaMasCercana(0.1, 0.9) === 'abajo-izq' && C.esquinaMasCercana(0.8, 0.2) === 'arriba-der' && C.esquinaValida('arriba-der') && !C.esquinaValida('centro'), 'al arrastrarla y soltarla, va a la esquina más cercana');
  // Lo que se ve encima en cada momento (exportar con correcciones)
  const dib = { t: 2, formas: [{ tipo: 'flecha', p: [[0.1, 0.1], [0.5, 0.5]] }] };
  const linea = C.lineaDeCapas({
    comentarios: [
      { id: 'c1', autor: 'coach', texto: '0:02 Rodillas fuera al bajar', dibujo: dib },
      { id: 'c2', autor: 'coach', texto: 'Muy bien la profundidad en el 0:05,5 de la última repetición, sigue así', dibujo: { t: 4, hasta: 6, formas: dib.formas } },
      { id: 'c3', autor: 'atleta', texto: '0:03 ¿Así?', dibujo: null },
      { id: 'c4', autor: 'coach', texto: '0:01 eliminado', eliminado_en: '2026-11-01T10:00:00Z' },
      { id: 'c5', autor: 'coach', texto: '0:20 fuera del vídeo' },
    ],
    revision: { checklist: { puntos: [{ t: 'Pies firmes', e: 'bien', s: 1 }, { t: 'Espalda neutra', e: 'mal' }] } },
    duracion: 8,
  });
  check(linea.length === 5 && linea.map((x) => x.tipo).join() === 'punto,comentario,dibujo,dibujo,comentario' && linea.every((x) => x.id !== 'c3' && x.id !== 'c4' && x.id !== 'c5'),
    `la línea de tiempo: los dibujos y los comentarios con su momento (del coach, sin lo eliminado ni lo de fuera del vídeo) y los puntos con el suyo (${linea.map((x) => `${x.tipo}@${x.desde}`).join(', ')})`);
  const en = (t) => C.capasEn(linea, t);
  check(en(1.5).textos[0].texto === '✓ Pies firmes' && en(2.2).dibujos.length === 1 && en(2.2).textos.some((x) => x.texto === 'Rodillas fuera al bajar') && en(4.6).dibujos.map((x) => x.id).join() === 'c2'
    && en(5).dibujos.length === 1 && en(5.6).textos.some((x) => /^Muy bien la profundidad en el de la última/.test(x.texto)) && en(7.5).dibujos.length === 0,
    'en cada momento: un dibujo sin tramo, 2,5 s desde el suyo; uno con tramo, mientras dura; un texto, 3 s');
  check(C.capasEn([1, 2, 3, 4, 5].map((i) => ({ tipo: 'comentario', desde: i * 0.1, hasta: 9, texto: `t${i}` })), 1).textos.map((x) => x.texto).join() === 't3,t4,t5', 'como mucho 3 textos a la vez (los más recientes): no tapan la imagen');
  check(C.textoNota(4) === 'Técnica 4/5 · Buena' && C.textoNota(null) === null && C.textoNota(6) === null && C.MARCA_AGUA === 'FBE', 'la nota de la esquina y la marca «FBE»');
  check(C.nombreExportado({ ejercicio: 'Sentadilla barra alta', fecha: '2026-11-04', ext: 'mp4' }) === 'sentadilla-barra-alta-2026-11-04-corregido.mp4' && C.nombreExportado({ ext: 'webm' }) === 'video-corregido.webm',
    'el nombre del archivo: el ejercicio y el día (nada del atleta)');
  check(C.progresoDe(5, 0, 10) === 0.5 && C.progresoDe(-1, 0, 10) === 0 && C.progresoDe(12, 0, 10) === 1 && C.progresoDe(3, 3, 3) === 0, 'el progreso, de 0 a 1');

  // 13. La caja de la cabeza con los puntos del cuerpo (MediaPipe Pose: 0 nariz, 1-6 ojos, 7-8 orejas, 9-10 boca)
  const pose = (cara, vis = 0.9) => Array.from({ length: 33 }, (_, i) => (i <= 10 ? { x: cara[0] + ((i % 5) - 2) * 0.01, y: cara[1] + (i % 3) * 0.008, visibility: vis } : { x: 0.5, y: 0.8, visibility: 0.9 }));
  const cj = K.cajaCabeza(pose([0.5, 0.2]), { w: 1080, h: 1920 });
  check(cj && cj.x < 0.5 && cj.x + cj.w > 0.5 && cj.y < 0.2 && cj.y + cj.h > 0.2 && Math.abs(cj.w * 1080 - cj.h * 1920) < 3 && cj.y + cj.h / 2 < 0.21,
    `la caja: alrededor de la cara, cuadrada en píxeles y un poco hacia arriba (la frente) (${JSON.stringify(cj)})`);
  check(K.cajaCabeza(pose([0.5, 0.2], 0.2), { w: 1080, h: 1920 }) === null && K.cajaCabeza(null) === null && K.cajaCabeza([{ x: 0.5, y: 0.5 }], { w: 100, h: 100 }) === null,
    'sin puntos de la cara visibles (o con menos de dos), ninguna caja');
  const borde = K.cajaCabeza(pose([0.01, 0.01]), { w: 1000, h: 1000 });
  check(borde.x === 0 && borde.y === 0 && borde.w > 0 && borde.x + borde.w <= 1 && borde.y + borde.h <= 1, 'en el borde de la imagen, la caja no se sale');
  const perfil = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  Object.assign(perfil, { 0: { x: 0.40, y: 0.30, visibility: 0.95 }, 2: { x: 0.42, y: 0.29, visibility: 0.9 }, 7: { x: 0.46, y: 0.30, visibility: 0.9 }, 11: { x: 0.45, y: 0.4, visibility: 0.9 }, 12: { x: 0.47, y: 0.4, visibility: 0.9 } });
  const cp = K.cajaCabeza(perfil, { w: 1000, h: 1000 });
  check(cp && cp.w >= 0.06 && cp.w * 1000 >= (0.46 - 0.40) * 1000 * 2.3 && cp.x < 0.40 && cp.x + cp.w > 0.46, 'de perfil (la nariz, un ojo y una oreja), con margen de sobra para toda la cabeza');
  // Rellenar los fotogramas sin cara
  const c0 = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, c1 = { x: 0.3, y: 0.1, w: 0.2, h: 0.2 };
  const it = K.interpolarCajas([{ t: 0, caja: c0 }, { t: 0.2, caja: null }, { t: 0.4, caja: c1 }, { t: 0.6, caja: null }]);
  const medio = it.cajas[1].caja;
  check(it.detectadas === 2 && it.rellenadas === 2 && it.cajas[1].rellena && medio.x < 0.2 && medio.x > 0.1 && medio.w > 0.2 && it.cajas[3].caja.w > 0.2 && Math.abs(it.cajas[3].caja.x + it.cajas[3].caja.w / 2 - 0.4) < 0.001,
    'un fotograma sin cara entre dos con ella: a medio camino (y un poco más grande); al final, la del último (agrandada)');
  check(it.cobertura === 0.5 && it.estado === 'bien' && it.huecoMax === 0.4, `con la mitad y huecos cortos, «bien» (${it.cobertura}, ${it.huecoMax} s)`);
  const largo = K.interpolarCajas([{ t: 0, caja: c0 }, ...[0.5, 1, 1.5, 2, 2.5].map((t) => ({ t, caja: null })), { t: 3, caja: c1 }]);
  check(largo.estado === 'avisar' && largo.huecoMax === 3 && largo.cajas.every((x) => x.caja), 'un hueco largo (3 s) se rellena igual, pero se avisa en la vista previa');
  const nada = K.interpolarCajas([{ t: 0, caja: null }, { t: 1, caja: null }]);
  check(nada.estado === 'nada' && nada.detectadas === 0 && nada.cajas.every((x) => x.caja === null) && K.interpolarCajas([]).estado === 'nada', 'sin cara en ningún fotograma: «nada» (no se envía un vídeo «difuminado» que no lo está)');
  check(/no se ha encontrado tu cara/i.test(K.textoDeteccion(nada)) && /Revisa la vista previa/.test(K.textoDeteccion(largo)) && /50 %/.test(K.textoDeteccion(it)), 'lo que dice la vista previa en cada caso');
  const ce = K.cajaEn(it.cajas, 0.1);
  check(ce && ce.x > c0.x && ce.x < medio.x + 0.01 && K.cajaEn(it.cajas, -1) === it.cajas[0].caja && K.cajaEn(it.cajas, 9) === it.cajas[3].caja && K.cajaEn([], 1) === null, 'la caja en un momento cualquiera (entre dos mirados, a medio camino; fuera, la más cercana)');
  const ts = K.tiemposCara(10), tsLargo = K.tiemposCara(500, { max: 600 });
  check(ts.length === 51 && ts[0] === 0 && ts.at(-1) < 10 && tsLargo.length === 600 && K.tiemposCara(0).length === 0, 'los momentos que se miran: unos 5 por segundo, como mucho 600 (memoria y tiempo acotados)');
  // (revisión L1 y L2) Nunca una caja diminuta; el tramo, de 2 minutos como mucho aunque no se recorte
  const mini = K.cajaMinima({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 }), esquina = K.cajaMinima({ x: 0.999, y: 0.999, w: 0.001, h: 0.001 });
  check(mini.w === K.CAJA_MIN && Math.abs(mini.x + mini.w / 2 - 0.5005) < 0.001 && esquina.x + esquina.w <= 1 && esquina.w >= K.CAJA_MIN - 1e-9 && K.cajaMinima(null) === null && K.cajaMinima(c0) .w === c0.w,
    '(L1) una caja diminuta se agranda al mínimo (sin salirse); una normal no cambia');
  const t1 = K.tramoDifuminar(0, null, 300), t2 = K.tramoDifuminar(10, 40, 300), t3 = K.tramoDifuminar(0, null, 90);
  check(t1.hasta === 120 && t1.recortado && t2.hasta === 40 && !t2.recortado && t3.hasta === 90 && !t3.recortado && K.tramoDifuminar(0, null, null).recortado,
    '(L2) difuminar: el tramo recortado, o todo el vídeo, de 2 minutos como mucho (y se dice si no cabe)');
  check(K.agrandar(c0, 2).w === 0.4 && K.agrandar({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 3).x + K.agrandar({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 3).w <= 1 && K.agrandar(c0, 1) === c0, 'agrandar una caja, sin salirse');

  // 9. Dos ángulos
  check(A.limitarDesfase(3) === 2 && A.limitarDesfase(-2.5) === -2 && A.limitarDesfase(1 / 30) === 0.033 && A.limitarDesfase('x') === 0, 'el desfase: de −2 a +2 s, con 3 decimales');
  check(A.tiempoPareja(1, 0.5) === 1.5 && A.tiempoPareja(0.2, -0.5) === 0 && A.tiempoPareja(9, 1, 8) === 8 && A.tiempoPareja(1, 5) === 3, 'el momento del otro ángulo (dentro de su vídeo)');
  const UU = '0b0f7a5e-1d2c-4c3b-9a8f-0e1d2c3b4a59';
  check(A.dosAngulosValido({ con: UU, desfase: 0.25 }) && A.dosAngulosValido({ con: UU, desfase: -2 }) && A.dosAngulosValido({ con: UU, desfase: 0.033 }), 'el desfase guardado: { con, desfase }');
  const malosA = [null, [], 'x', {}, { con: UU }, { desfase: 0 }, { con: UU, desfase: 2.01 }, { con: UU, desfase: 0.0333 }, { con: UU, desfase: '0.5' }, { con: 'no', desfase: 0 }, { con: UU.toUpperCase(), desfase: 0 },
    { con: UU, desfase: 0, x: 1 }, { con: UU, desfase: Infinity }, { con: UU, desfase: NaN }, { con: 5, desfase: 0 }];
  check(malosA.every((j) => !A.dosAngulosValido(j)), `y nada más (${malosA.length} mal formados, como dos_angulos_valido de la 038)`);
  check(A.textoDesfase(0) === 'sin desfase' && A.textoDesfase(0.25) === '+0,25 s' && A.textoDesfase(-1 / 30) === '−0,033 s (−1 fotograma)', 'el texto del desfase');
  const lista = [{ id: 'a', tipo: 'video_tecnica', angulo_de: null }, { id: 'b', tipo: 'video_tecnica', angulo_de: 'a' }, { id: 'c', tipo: 'video_tecnica', angulo_de: null }];
  check(A.parejaDe(lista[0], lista)?.id === 'b' && A.parejaDe(lista[1], lista)?.id === 'a' && A.parejaDe(lista[2], lista) === null && !A.admiteOtroAngulo(lista[0], lista) && A.admiteOtroAngulo(lista[2], lista),
    'la pareja de un vídeo (la enlace él o el otro) y si admite otro ángulo');
  check(A.disposicionAngulos(390) === 'pila' && A.disposicionAngulos(980) === 'lado', 'uno encima del otro en un móvil; uno al lado del otro si caben');
  // 11. La cámara lenta
  check(A.elegirCamaraLenta({ frameRate: { max: 30 } }) === null && A.elegirCamaraLenta(null) === null && A.elegirCamaraLenta({}) === null, 'sin 60 fps (o si la cámara no lo dice), no hay cámara lenta');
  const l60 = A.elegirCamaraLenta({ frameRate: { max: 60 }, width: { max: 1920 }, height: { max: 1080 } }), l240 = A.elegirCamaraLenta({ frameRate: { max: 240 }, width: { max: 3840 }, height: { max: 2160 } });
  const l120 = A.elegirCamaraLenta({ frameRate: { max: 120.0 }, width: { max: 1280 }, height: { max: 720 } });
  check(l60.fps === 60 && l60.width === 1920 && l120.fps === 120 && l120.width === 1280 && l240.fps === 240 && l240.width === 1280 && l240.height === 720, 'pide 240 o 120 si la cámara llega; si no, 60; con una resolución que llegue a ese ritmo');
  check(A.velocidadInicial(240) === 0.25 && A.velocidadInicial(120) === 0.25 && A.velocidadInicial(60) === 0.5 && A.velocidadInicial(30) === 1 && A.velocidadInicial(null) === 1, 'se abre a 0,25× (100 fps o más) o 0,5× (50 o más)');
  check(A.fpsGuardado(119.88) === 120 && A.fpsGuardado(10) === null && A.fpsGuardado(300) === null && A.fpsGuardado('x') === null, 'el ritmo que se guarda (038: de 24 a 240)');
  check(/Cámara lenta/.test(A.textoSinLenta({ ios: true })) && /galería/.test(A.textoSinLenta({ ios: false })), 'y cuando no se puede, se dice (en el iPhone, la cámara lenta del propio móvil)');
  // La política: lo nuevo, en la 2026-12.2
  const PV2 = await import('../web/src/logica/privacidad.js');
  const legal3 = await import('../web/src/legal.js');
  const tv3 = legal3.PRIVACIDAD.find((x) => x[0] === 'Tus vídeos de técnica')[1];
  check(PV2.compararVersiones(legal3.VERSION_LEGAL, '2026-12.2') >= 0 && PV2.NOVEDADES_PRIVACIDAD.some((x) => x[3] === '2026-12.2') && PV2.novedadesDesde('2026-12.1', '2026-12.2').length === 1
    && /micro/.test(tv3) && /cámara de delante/.test(tv3) && /no se sube a ningún sitio/.test(tv3) && /el original no sale del móvil/.test(tv3),
    'la política 2026-12.2: el micro y la cámara de delante (revisión grabada y respuestas), exportar en el móvil y difuminar la cara (el original no sale)');
}

// v0.61: los vídeos de técnica, tanda B (segunda mitad): revisar la sesión, la estela, el perfil carga–velocidad, el
// informe del mes y solo con wifi
console.log('\nv0.61: revisar la sesión, la estela, el perfil carga–velocidad, el informe del mes y solo con wifi');
{
  const CV = await import('../web/src/logica/cargaVelocidad.js');
  const ES = await import('../web/src/logica/estela.js');
  const RD = await import('../web/src/logica/red.js');
  const SV = await import('../web/src/logica/sesionVideos.js');
  const IT = await import('../web/src/logica/informeTecnica.js');
  const cerca = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  // ---------- 16. La recta, el R² y el 1RM
  const rg = CV.regresionLineal([{ kg: 60, v: 0.95 }, { kg: 80, v: 0.775 }, { kg: 100, v: 0.6 }]);
  check(cerca(rg.b, -0.00875) && cerca(rg.a, 1.475) && cerca(rg.r2, 1) && rg.n === 3, 'la recta de mínimos cuadrados (v = 1,475 − 0,00875 · kg) y su R² = 1 con puntos alineados');
  const rg2 = CV.regresionLineal([{ kg: 50, v: 1 }, { kg: 70, v: 0.7 }, { kg: 90, v: 0.65 }, { kg: 110, v: 0.35 }]);
  check(cerca(rg2.b, -0.0101, 1e-4) && rg2.r2 > 0.9 && rg2.r2 < 1, `con ruido: pendiente −0,0101 y R² ${rg2.r2.toFixed(3)}`);
  check(CV.regresionLineal([{ kg: 80, v: 0.6 }, { kg: 80, v: 0.7 }, { kg: 80, v: 0.5 }]) === null && CV.regresionLineal([{ kg: 80, v: 0.6 }]) === null && CV.regresionLineal([]) === null,
    'con todas las cargas iguales (o menos de 2 puntos) no hay recta');
  check(CV.regresionLineal([{ kg: 60, v: 0.5 }, { kg: 80, v: 0.5 }, { kg: 100, v: 0.5 }]).r2 === 0, 'con todas las velocidades iguales, R² 0 (no un NaN)');
  const vid = (kg, vms, fecha = '2026-10-10', extra = {}) => ({ id: `v${kg}-${fecha}-${Math.random()}`, tipo: 'video_tecnica', fecha, serie: kg == null ? null : { kg }, revision: { analisis: { reps: vms.map((vm) => ({ t: [0, 1, 2], vm })) } }, ...extra });
  check(CV.mejorVelocidad({ reps: [{ vm: 0.5 }, { vm: 0.62 }, { vm: 'x' }, { vm: 4 }, {}] }) === 0.62 && CV.mejorVelocidad(null) === null && CV.mejorVelocidad({ reps: [] }) === null, 'de cada vídeo, la velocidad media de su mejor repetición (lo que no es una velocidad, fuera)');
  const pts = CV.puntosPerfil([vid(60, [0.9, 0.95]), vid(null, [0.8]), vid(0, [0.8]), { ...vid(80, [0.7]), revision: null }, vid(100, [0.6]), { ...vid(70, [0.8]), tipo: 'foto_progreso' }, vid(90, [0.7], '2026-11-02')]);
  check(pts.length === 3 && pts[0].kg === 60 && pts[0].v === 0.95 && pts.every((p) => p.kg > 0), 'un punto por vídeo con su carga y su análisis (sin carga, a 0 kg, sin análisis o sin ser de técnica, no cuenta)');
  check(CV.puntosPerfil([vid(60, [0.9]), vid(90, [0.7], '2026-11-02')], { hasta: '2026-10-31' }).length === 1, 'y hasta un día (para comparar meses)');
  const tres = [vid(60, [0.95]), vid(80, [0.76]), vid(100, [0.61])];
  const p3 = CV.perfilCargaVelocidad(tres, { umbral: 0.3 });
  check(p3.estado === 'ok' && p3.cargas === 3 && p3.n === 3 && p3.avisos.includes('pocas-cargas') && cerca(p3.e1rm, 136.5, 1) && p3.r2 > 0.99,
    `con 3 cargas distintas, el 1RM a 0,30 m/s (${p3.e1rm} kg), con el aviso de que son pocas`);
  const p3b = CV.perfilCargaVelocidad(tres, { umbral: 0.17 });
  check(p3b.e1rm > p3.e1rm && p3b.e1rm % 0.5 === 0, 'una velocidad mínima más baja da un 1RM más alto (redondeado a 0,5 kg)');
  const dos = CV.perfilCargaVelocidad([vid(60, [0.95]), vid(60, [0.9]), vid(100, [0.61])], { umbral: 0.3 });
  check(dos.estado === 'pocos' && dos.e1rm == null && dos.cargas === 2 && dos.n === 3, 'con solo 2 cargas distintas (aunque haya 3 vídeos), nunca un 1RM');
  check(CV.perfilCargaVelocidad([], {}).estado === 'sin-datos' && CV.perfilCargaVelocidad([vid(60, [0.9])]).estado === 'pocos', 'sin puntos, nada; con uno, «pocos»');
  const iguales = CV.perfilCargaVelocidad([vid(80, [0.6]), vid(80, [0.7]), vid(80, [0.65])], { umbral: 0.3 });
  check(iguales.estado === 'pocos' && iguales.e1rm == null, 'todas a la misma carga: sin 1RM');
  const sube = CV.perfilCargaVelocidad([vid(60, [0.5]), vid(80, [0.6]), vid(100, [0.7])], { umbral: 0.3 });
  check(sube.estado === 'sin-pendiente' && sube.e1rm == null, 'si la velocidad no baja al subir la carga (pendiente ≥ 0), sin 1RM');
  const plana = CV.perfilCargaVelocidad([vid(60, [0.6]), vid(80, [0.6]), vid(100, [0.6])], { umbral: 0.3 });
  check(plana.estado === 'sin-pendiente', 'ni con la pendiente a cero');
  const alto = CV.perfilCargaVelocidad(tres, { umbral: 0.8 });
  check(alto.estado === 'incoherente' && alto.e1rm == null, 'una velocidad mínima por encima de lo ya levantado: sin 1RM (no puede ser menos que lo movido)');
  const lejos = CV.perfilCargaVelocidad([vid(20, [1.2]), vid(22, [1.19]), vid(24, [1.185])], { umbral: 0.15 });
  check(lejos.estado === 'lejos' && lejos.e1rm == null, 'si el 1RM queda a más de 2,5 veces la mayor carga, no se da');
  const extrap = CV.perfilCargaVelocidad([vid(40, [1.0]), vid(50, [0.9]), vid(60, [0.8]), vid(70, [0.7])], { umbral: 0.17 });
  check(extrap.estado === 'ok' && extrap.avisos.includes('extrapola') && !extrap.avisos.includes('pocas-cargas'), `con 4 cargas, sin el aviso de pocas; extrapolando mucho (${extrap.e1rm} kg desde 70), con el suyo`);
  const ruido = CV.perfilCargaVelocidad([vid(60, [0.95]), vid(80, [0.55]), vid(100, [0.75]), vid(110, [0.4])], { umbral: 0.3 });
  check(ruido.r2 < CV.R2_BAJO && ruido.avisos.includes('r2-bajo'), `R² bajo (${ruido.r2}): con su aviso`);
  const estrecho = CV.perfilCargaVelocidad([vid(100, [0.5]), vid(105, [0.46]), vid(110, [0.42])], { umbral: 0.3 });
  check(estrecho.avisos.includes('rango-estrecho'), 'cargas muy juntas (100–110 kg): con su aviso');
  const conAtipico = [vid(40, [1.1]), vid(60, [0.95]), vid(70, [0.86]), vid(80, [0.77]), vid(90, [0.69]), vid(100, [1.5]), vid(110, [0.52])];
  const pa = CV.perfilCargaVelocidad(conAtipico, { umbral: 0.3 });
  check(pa.atipicos.length === 1 && pa.atipicos[0].kg === 100 && pa.avisos.includes('atipicos') && pa.r2 > 0.98 && pa.estado === 'ok',
    `un vídeo muy fuera de la recta (100 kg a 1,5 m/s) se deja fuera (con aviso) y la recta queda limpia (R² ${pa.r2})`);
  check(CV.quitarAtipicos(conAtipico.slice(0, 4).map((v) => ({ kg: v.serie.kg, v: v.revision.analisis.reps[0].vm }))).atipicos.length === 0, 'con menos de 5 puntos no se quita ninguno');
  const pocasTrasQuitar = CV.quitarAtipicos([{ kg: 60, v: 0.9 }, { kg: 60, v: 0.91 }, { kg: 60, v: 0.92 }, { kg: 80, v: 0.7 }, { kg: 100, v: 2 }]);
  check(pocasTrasQuitar.atipicos.length === 0, 'ni si al quitarlo quedarían menos de 3 cargas distintas');
  // Las velocidades mínimas de serie y las del coach
  check(CV.umbralPorDefecto('Sentadilla barra alta').v === 0.3 && CV.umbralPorDefecto('Press banca').v === 0.17 && CV.umbralPorDefecto('Press de banca inclinado').v === 0.17
    && CV.umbralPorDefecto('Peso muerto convencional').v === 0.15 && CV.umbralPorDefecto('Peso muerto rumano').generico && CV.umbralPorDefecto('Press militar').v === 0.19
    && CV.umbralPorDefecto('Dominadas lastradas').v === 0.23 && CV.umbralPorDefecto('Curl de bíceps').generico && CV.umbralPorDefecto('Curl de bíceps').v === 0.3,
    'las de serie: sentadilla 0,30, banca 0,17, peso muerto 0,15 (el rumano no), militar 0,19, dominadas 0,23; el resto, la genérica (0,30)');
  check(CV.umbralDe({ id: 'e1', nombre: 'Sentadilla' }, { e1: 0.33 }).v === 0.33 && CV.umbralDe({ id: 'e1', nombre: 'Sentadilla' }, { e1: 2 }).v === 0.3 && CV.umbralDe({ id: 'e1', nombre: 'Sentadilla' }, {}).propio === false,
    'la del coach manda (si es válida); si no, la de serie');
  const malosU = [0, 0.04, 0.049, 1.001, 2, -0.3, NaN, Infinity, -Infinity, 0.1234, 0.30001, '0.3', null, undefined, {}, [], true];
  check(CV.umbralValido(0.05) && CV.umbralValido(1) && CV.umbralValido(0.175) && CV.umbralValido(0.3) && malosU.every((x) => !CV.umbralValido(x)), `una velocidad mínima: de 0,05 a 1 m/s con 3 decimales (${malosU.length} que no, como umbral_velocidad_valido de la 039)`);
  check(CV.leerUmbral('0,3') === 0.3 && CV.leerUmbral('0.175') === 0.175 && CV.leerUmbral('1') === 1 && CV.leerUmbral('0,1234') === null && CV.leerUmbral('2') === null && CV.leerUmbral('abc') === null && CV.leerUmbral('') === null && CV.leerUmbral(',') === null,
    'lo que escribe el coach («0,3», «0.175»), o null');
  // Comparar con el 1RM por repeticiones y RPE
  const ser = [{ kg: 100, reps: 5, rpe: 8, fecha: '2026-10-01' }, { kg: 110, reps: 3, rpe: 9, fecha: '2026-10-20' }, { kg: 140, reps: 1, rpe: 10, fecha: '2026-06-01' }];
  const pr = CV.e1rmPorRepeticiones(ser, { hasta: '2026-10-31' });
  check(pr.valor === 124.7 && pr.fecha === '2026-10-20' && CV.e1rmPorRepeticiones(ser, { hasta: '2026-06-30' }).valor === 140,
    'el 1RM por repeticiones y RPE: el mejor de las 8 semanas anteriores (como en Progreso)');
  check(CV.diferenciaPct(110, 100) === 10 && CV.diferenciaPct(90, 100) === -10 && CV.diferenciaPct(null, 100) === null, 'y en cuánto difieren');
  check(CV.textoKg(136.5) === '136,5 kg' && CV.textoUmbral(0.3) === '0,30 m/s' && CV.textoUmbral(0.175) === '0,175 m/s' && /3 cargas/.test(CV.textoEstado(dos)) && /no baja/.test(CV.textoEstado(sube)), 'los textos');

  // ---------- 8. La estela
  const tray = ES.limpiarTrayectoria([[0, 0.5, 0.2], [0.5, 0.5, 0.4], [1, 0.5, 0.6], [1.5, 0.5, 0.8], [1.4, 0.1, 0.1], ['x', 0, 0], [2, 1.2, 0.5]]);
  check(tray.length === 4, 'la trayectoria limpia: en orden, dentro de la imagen (lo demás, fuera)');
  const pe = ES.puntosEstela(tray, 1.2, { ventana: 0.5 });
  check(pe.length === 3 && cerca(pe[0][0], 0.7) && cerca(pe[pe.length - 1][0], 1.2) && cerca(pe[pe.length - 1][2], 0.68) && cerca(pe[1][0], 1),
    'en t, los puntos de los últimos N fotogramas: desde t − ventana (interpolado) hasta t (interpolado)');
  check(ES.puntosEstela(tray, -1).length === 0 && ES.puntosEstela(tray, 5, { ventana: 0.5 }).length === 0 && ES.puntosEstela([], 1).length === 0 && ES.puntosEstela(tray, NaN).length === 0,
    'antes de empezar, mucho después de acabar o sin trayectoria, nada');
  check(ES.alfaEstela(0, 1) === 1 && cerca(ES.alfaEstela(0.5, 1), 0.25) && ES.alfaEstela(1, 1) === ES.ALFA_MIN && ES.alfaEstela(1.2, 1) === 0 && ES.alfaEstela(-0.1, 1) === 0 && ES.alfaEstela(0.1, 0) === 0,
    'la transparencia: 1 lo de ahora, se apaga (cuadrática) hasta el mínimo al final de la ventana; fuera, 0');
  const sg = ES.segmentosEstela(tray, 1.5, { ventana: 1 });
  check(sg.length >= 2 && sg.every((x, i) => i === 0 || x.alfa >= sg[i - 1].alfa) && sg[sg.length - 1].alfa > 0.5 && sg[0].alfa < 0.5, 'los tramos, del más viejo (tenue) al más nuevo (fuerte)');
  const conHueco = [[0, 0.1, 0.1], [0.1, 0.2, 0.2], [1.5, 0.8, 0.8], [1.6, 0.9, 0.9]];
  const sh = ES.segmentosEstela(conHueco, 1.6, { ventana: 2 });
  check(sh.length === 2 && sh.every((x) => Math.abs(x.a[0] - x.b[0]) < 0.2), 'un hueco de más de medio segundo corta la estela (no se une)');
  const est = ES.segmentosEstela(tray, 0.2, { estatica: true });
  check(est.length === tray.length - 1 && est.every((x) => x.alfa === 0.85), 'con «reducir movimiento», la trayectoria entera y quieta (misma transparencia, no depende de t)');
  check(igual(ES.cabezaEstela(tray, 0.25), [0.5, 0.30000000000000004]) || cerca(ES.cabezaEstela(tray, 0.25)[1], 0.3), 'la cabeza: dónde está ahora');
  check(cerca(ES.segundosEstela(45), 1.5) && cerca(ES.segundosEstela(15), 0.5) && cerca(ES.segundosEstela(7), 1.5), 'lo larga: 15, 45 o 90 fotogramas (a 30 por segundo); otra cosa, la media');
  const fotos = [0, 0.1, 0.2, 0.3].map((t) => ({ t, kp: Array.from({ length: 33 }, (_, i) => (i === 23 ? [0.4, 0.5 + t, 0.9] : i === 24 ? [0.6, 0.5, 0.2] : [0.5, 0.5, 0.9])) }));
  check(ES.trayectoriaArticulacion(fotos, 'cadera', 'izq').length === 4 && ES.trayectoriaArticulacion(fotos, 'cadera', 'der').length === 0 && ES.trayectoriaArticulacion(fotos, 'nada').length === 0,
    'la de una articulación con los puntos del cuerpo de esta sesión: del lado elegido y solo donde se ve bien');
  check(igual(ES.fuentesEstela({ barra: tray }).map((x) => x[0]), ['barra']) && ES.fuentesEstela({ barra: null, pose: { fotos, lado: 'izq' } }).some((x) => x[0] === 'cadera') && !ES.fuentesEstela({}).length,
    'qué se puede seguir: la barra (guardada o de esta sesión) y, con puntos del cuerpo, las articulaciones');
  check(ES.trayectoriaEstela({ fuente: 'rodilla', barra: tray }).fuente === 'barra' && ES.trayectoriaEstela({ fuente: 'cadera', barra: tray, pose: { fotos, lado: 'izq' } }).fuente === 'cadera' && ES.trayectoriaEstela({}).fuente === null,
    'si lo elegido no está, la primera que haya');
  const largo = Array.from({ length: 1200 }, (_, i) => [i / 30, 0.5, (i % 30) / 30]);
  check(ES.segmentosEstela(largo, 39, { estatica: true }).length <= ES.MAX_SEGMENTOS + 1, 'una trayectoria larga no pinta cientos de líneas');

  // ---------- 20. Solo con wifi
  const nav = (c, onLine = true) => ({ connection: c, onLine });
  const android4g = RD.leerRed(nav({ type: 'cellular', saveData: false }));
  const androidWifi = RD.leerRed(nav({ type: 'wifi' }));
  const iphone = RD.leerRed(nav(undefined)), escritorio = RD.leerRed(nav({ effectiveType: '4g', saveData: false }));
  check(android4g.celular && !android4g.wifi && android4g.conocida && androidWifi.wifi && !iphone.conocida && iphone.tipo === null && escritorio.tipo === null, 'el tipo de conexión: solo lo dice Chrome de Android');
  check(RD.mostrarOpcionWifi(android4g) && RD.mostrarOpcionWifi(androidWifi) && !RD.mostrarOpcionWifi(iphone) && !RD.mostrarOpcionWifi(escritorio), 'la opción sale solo donde se sabe (en el iPhone y el ordenador, no)');
  check(RD.motivoEspera({ soloWifi: true, red: android4g }) === 'wifi' && RD.motivoEspera({ soloWifi: true, red: androidWifi }) === null && RD.motivoEspera({ soloWifi: false, red: android4g }) === null
    && RD.motivoEspera({ soloWifi: true, red: android4g, forzado: true }) === null && RD.motivoEspera({ soloWifi: true, red: iphone }) === null,
    'con «solo con wifi» y datos móviles, espera; con wifi, sin la opción o con «Subir ahora», sale; donde no se sabe, sale');
  check(RD.leerRed(nav({ type: 'bluetooth' })).celular && RD.leerRed(nav({ type: 'ethernet' })).wifi && !RD.leerRed(nav({ type: 'unknown' })).conocida, 'compartir datos por bluetooth cuenta como datos; el cable, como wifi');
  check(RD.motivoEspera({ red: RD.leerRed(nav({ type: 'cellular', saveData: true })) }) === null && RD.motivoEspera({ red: RD.leerRed(nav({ saveData: true })) }) === null
    && RD.motivoEspera({ soloWifi: true, red: RD.leerRed(nav({ saveData: true })) }) === null,
    '(revisión L1) sin «solo con wifi», el ahorro de datos no retiene nada; y donde no se sabe el tipo de conexión (ordenador), tampoco');
  check(RD.motivoEspera({ soloWifi: true, red: RD.leerRed(nav({ type: 'other', saveData: true })) }) === 'ahorro' && RD.motivoEspera({ soloWifi: true, red: RD.leerRed(nav({ type: 'other' })) }) === null
    && RD.motivoEspera({ soloWifi: true, red: RD.leerRed(nav({ type: 'wifi', saveData: true })) }) === null && RD.motivoEspera({ soloWifi: true, red: RD.leerRed(nav({ type: 'cellular', saveData: true })) }) === 'wifi',
    'con «solo con wifi», una red conocida que no es wifi (ni datos) y el ahorro de datos, espera; con wifi, nunca');
  // (revisión L3) La píldora, con todas las subidas en marcha
  const SB = await import('../web/src/datos/subidas.js');
  check(SB.resumirSubidas([]) === null && igual(SB.resumirSubidas([{ progreso: 0.2 }, { progreso: 0.6 }]), { n: 2, progreso: 0.4 }), '(revisión L3) la píldora resume todas las subidas en marcha (cuántas y su progreso)');
  SB.subidaEmpieza('a'); SB.subidaEmpieza('b'); SB.subidaProgreso('a', 0.5);
  const dosSub = SB.subidaActual();
  SB.subidaAcaba('a', { ok: false });
  const una = SB.subidaActual();
  SB.subidaAcaba('b', { ok: false });
  check(dosSub.n === 2 && una.n === 1 && una.progreso === 0 && SB.subidaActual() === null, 'y solo se va cuando han acabado todas (no al acabar la primera)');
  check(RD.leerRed(nav({ type: 'wifi' }, false)).enLinea === false && RD.leerRed(null).tipo === null, 'y sin conexión, lo dice');

  // ---------- 5. Revisar la sesión
  const pautas = { pa: { sesion_id: 's1', orden: 2 }, pb: { sesion_id: 's1', orden: 1 }, pc: { sesion_id: 's2', orden: 1 } };
  const vs = [
    { id: 'v1', tipo: 'video_tecnica', atleta_id: 'a', sesion_ejercicio_id: 'pa', serie_numero: 2, creado_en: '2026-11-03T10:00:00Z' },
    { id: 'v2', tipo: 'video_tecnica', atleta_id: 'a', sesion_ejercicio_id: 'pb', serie_numero: 3, creado_en: '2026-11-03T10:05:00Z' },
    { id: 'v3', tipo: 'video_tecnica', atleta_id: 'a', sesion_ejercicio_id: 'pa', serie_numero: 1, creado_en: '2026-11-03T10:10:00Z' },
    { id: 'v4', tipo: 'video_tecnica', atleta_id: 'a', sesion_ejercicio_id: 'pc', creado_en: '2026-11-03T10:15:00Z' },
    { id: 'v5', tipo: 'video_tecnica', atleta_id: 'a', sesion_ejercicio_id: null },
    { id: 'f1', tipo: 'foto_progreso', atleta_id: 'a', sesion_ejercicio_id: 'pa' },
    { id: 'v6', tipo: 'video_tecnica', atleta_id: 'b', sesion_ejercicio_id: 'pb' },
  ];
  const ag = SV.agruparPorSesion(vs, pautas);
  check(ag.grupos.length === 1 && igual(ag.grupos[0].videos.map((v) => v.id), ['v2', 'v3', 'v1']) && ag.grupos[0].sesionId === 's1',
    'los de una misma sesión y atleta, juntos, en el orden de los ejercicios de la sesión y, dentro, por su serie');
  check(igual(ag.sueltos.map((v) => v.id), ['v4', 'v5', 'f1', 'v6']), 'uno solo de su sesión, uno sin sesión, una foto o el de otro atleta van sueltos');
  check(SV.agruparPorSesion([], {}).grupos.length === 0 && SV.sesionDeVideo({ tipo: 'video_tecnica', sesion_ejercicio_id: 'zz' }, pautas) === null, 'sin nada, nada');
  check(SV.tituloSesion('2026-11-03', 4, '2026-11-04') === 'Sesión de ayer · 4 vídeos' && SV.tituloSesion('2026-11-04', 2, '2026-11-04') === 'Sesión de hoy · 2 vídeos'
    && SV.tituloSesion('2026-11-01', 3, '2026-11-04') === 'Sesión del domingo · 3 vídeos' && SV.tituloSesion('2026-10-03', 1, '2026-11-04') === 'Sesión del 3 oct · 1 vídeo' && SV.tituloSesion(null) === 'Sesión',
    '«Sesión del domingo · 3 vídeos» (en la última semana), de hoy, de ayer o con su día');
  const tsp = SV.textoSeriesPauta([{ numero: 2, kg: 62.5, reps: 8, rpe: 8.5 }, { numero: 1, kg: 60, reps: 8, rpe: null, rir: 2 }, { numero: 3, kg: null, reps: 10 }], 2);
  check(igual(tsp.map((x) => x.texto), ['60 kg × 8 RIR 2', '62,5 kg × 8 @8,5', '10 reps']) && tsp[1].delVideo && !tsp[0].delVideo, 'las series de la sesión, con la del vídeo marcada');
  const bor = SV.borradorResumen([
    { ejercicio: { nombre: 'Sentadilla' }, serie: { numero: 2 }, revision: { puntuacion: 4, checklist: { puntos: [{ t: 'Cadera y pecho suben a la vez', e: 'mal' }, { t: 'Pie', e: 'bien' }] } } },
    { ejercicio: { nombre: 'Press banca' }, revision: null },
  ], { nombre: 'Ana López' });
  check(bor.startsWith('Resumen de la sesión, Ana:') && bor.includes('· Sentadilla (serie 2): 4/5 (buena), a corregir: cadera y pecho suben a la vez') && bor.includes('· Press banca\n'),
    'el borrador del resumen: una línea por vídeo con lo ya corregido');
  check(SV.limpiarResumen('  Hola  \r\n\r\n\r\n\r\nFin  ') === 'Hola\n\nFin' && SV.limpiarResumen('   ') === null && SV.limpiarResumen('​') === null && SV.limpiarResumen('x'.repeat(4001)) === null && SV.limpiarResumen('x'.repeat(4000)).length === 4000,
    'lo que se manda: sin espacios de sobra, con algo visible, hasta 4000 letras');
  check(SV.esResumenSesion({ autor: 'coach', sesion_id: 's', texto: 'Resumen de la sesión: bien' }) && !SV.esResumenSesion({ autor: 'atleta', sesion_id: 's', texto: 'Resumen de la sesión' })
    && !SV.esResumenSesion({ autor: 'coach', sesion_id: null, texto: 'Resumen de la sesión' }) && !SV.esResumenSesion({ autor: 'coach', sesion_id: 's', texto: 'Resumen de la sesión', eliminado_en: 'x' }),
    'un resumen es del coach, en el hilo de una sesión y sin eliminar (así no se manda dos veces)');
  check(igual(SV.progresoSesion([{ id: 'a' }, { id: 'b', revisado_en: 'x' }, { id: 'c', revision: { corregido_el: '2026-11-01' } }], new Set(['a'])), { hechos: 3, total: 3 }), 'cuántos de la sesión están revisados');

  // ---------- 17. El informe del mes
  const ej1 = { id: 'e1', nombre: 'Sentadilla' }, ej2 = { id: 'e2', nombre: 'Press banca' };
  const vi = (o) => ({ tipo: 'video_tecnica', ...o });
  const lista = [
    vi({ id: 'a', fecha: '2026-10-02', creado_en: '2026-10-02T12:00:00', revisado_en: '2026-10-03T12:00:00', ejercicio: ej1, serie: { kg: 60 }, revision: { puntuacion: 3, corregido_el: '2026-10-03', checklist: { puntos: [{ t: 'Cadera y pecho suben a la vez', e: 'mal' }, { t: 'Pie entero', e: 'bien' }] }, analisis: { reps: [{ vm: 0.95 }] } } }),
    vi({ id: 'b', fecha: '2026-10-15', creado_en: '2026-10-15T12:00:00', revisado_en: null, ejercicio: ej1, serie: { kg: 80 }, revision: { puntuacion: 4, corregido_el: '2026-10-15', checklist: { puntos: [{ t: 'cadera y  pecho suben a la vez', e: 'mal' }, { t: 'Rodillas fuera', e: 'mal' }] }, analisis: { reps: [{ vm: 0.76 }] } } }),
    vi({ id: 'c', fecha: '2026-10-28', creado_en: '2026-10-28T12:00:00', revisado_en: '2026-10-31T12:00:00', ejercicio: ej1, serie: { kg: 100 }, destacado: true, revision: { puntuacion: 4, corregido_el: '2026-10-30', analisis: { reps: [{ vm: 0.61 }] } } }),
    vi({ id: 'd', fecha: '2026-10-20', creado_en: '2026-10-20T12:00:00', revisado_en: null, ejercicio: ej2, revision: null }),
    vi({ id: 'e', fecha: '2026-09-20', creado_en: '2026-09-20T12:00:00', revisado_en: '2026-09-21T12:00:00', ejercicio: ej1, serie: { kg: 70 }, revision: { puntuacion: 2, corregido_el: '2026-09-21', analisis: { reps: [{ vm: 0.86 }] } } }),
    vi({ id: 'f', fecha: '2026-09-25', ejercicio: ej1, serie: { kg: 90 }, revision: { puntuacion: 2, analisis: { reps: [{ vm: 0.68 }] } } }),
    vi({ id: 'g', fecha: '2026-09-27', ejercicio: ej1, serie: { kg: 50 }, revision: { analisis: { reps: [{ vm: 1.04 }] } } }),
    { id: 'h', tipo: 'foto_progreso', fecha: '2026-10-05' },
  ];
  const inf = IT.informeMes(lista, { mes: '2026-10', recordatorios: [{ id: 1 }, { id: 2 }], umbrales: {} });
  check(inf.enviados === 4 && inf.revisados === 3 && inf.medianaDias === 1 && inf.recordatorios === 2 && !inf.vacio,
    'vídeos enviados (4, sin la foto ni los de otro mes), revisados (3: dado por revisado o corregido) y la mediana de días hasta la revisión (1)');
  const sen = inf.ejercicios.find((e) => e.id === 'e1');
  check(sen.videos === 3 && igual(sen.notas.map((x) => x.nota), [3, 4, 4]) && sen.primera === 3 && sen.ultima === 4 && sen.cambio === 1 && sen.media === 3.7 && inf.ejercicios[0].id === 'e1'
    && inf.ejercicios.find((e) => e.id === 'e2').notas.length === 0, 'la nota de cada ejercicio a lo largo del mes (y cómo cambia)');
  check(inf.aCorregir.length === 2 && inf.aCorregir[0].n === 2 && inf.aCorregir[0].texto === 'Cadera y pecho suben a la vez' && inf.aCorregir[1].texto === 'Rodillas fuera',
    'los puntos «a corregir» que más salen (mismo texto aunque cambien mayúsculas o espacios)');
  check(inf.mejor.id === 'c' && inf.mejor.porque === 'destacado', 'el mejor vídeo: el destacado');
  const sinDest = IT.informeMes(lista.map((v) => ({ ...v, destacado: false })), { mes: '2026-10' });
  check(sinDest.mejor.id === 'c' && sinDest.mejor.porque === 'nota' && sinDest.mejor.nota === 4, 'sin destacado, el de mejor nota (el más reciente si empatan)');
  const e1 = inf.e1rm.find((x) => x.id === 'e1');
  check(!!e1 && e1.ahora > 0 && e1.antes > 0 && e1.cambio === Math.round((e1.ahora - e1.antes) * 2) / 2 && inf.e1rm.length === 1,
    `el 1RM estimado por la velocidad al final del mes y del anterior (${e1?.antes} → ${e1?.ahora} kg)`);
  const sinAntes = IT.informeMes(lista.filter((v) => v.fecha >= '2026-10-01'), { mes: '2026-10' });
  check(sinAntes.e1rm[0]?.antes === null && sinAntes.e1rm[0]?.cambio === null, 'si el mes anterior no tenía perfil (menos de 3 cargas), solo el de ahora');
  const vacio = IT.informeMes(lista, { mes: '2026-08' });
  check(vacio.vacio && vacio.enviados === 0 && vacio.medianaDias === null && vacio.mejor === null && IT.informeMes(lista, { mes: '2026-13' }) === null && IT.informeMes(lista, { mes: 'x' }) === null,
    'un mes sin vídeos, vacío; un mes que no existe, null');
  check(igual(IT.mesesConVideos(lista), ['2026-10', '2026-09']), 'los meses con vídeos, del más reciente');
  check(IT.diasHastaRevision({ creado_en: '2026-10-02T12:00:00', revisado_en: '2026-10-02T18:00:00' }) === 0 && IT.diasHastaRevision({ fecha: '2026-10-01', revision: { corregido_el: '2026-10-04' } }) === 3 && IT.diasHastaRevision({ fecha: '2026-10-01' }) === null,
    'los días hasta la revisión (el primero entre «revisado» y «corregido»)');
  check(IT.textoDias(0) === 'el mismo día' && IT.textoDias(1) === '1 día' && IT.textoDias(2.5) === '2,5 días' && IT.textoDias(null) === '—', 'en días, nunca en horas');
  check(IT.textoTarjetaInforme('2026-10') === 'Tu informe de técnica de octubre de 2026' && IT.textoTarjetaInforme('2026-1') === null, 'el mensaje de la tarjeta del chat');
  const tj = { autor: 'coach', texto: 'Tu informe de técnica de octubre de 2026' };
  check(IT.leerTarjetaInforme(tj) === '2026-10' && IT.leerTarjetaInforme({ ...tj, texto: 'Tu informe de técnica de enero de 2027' }) === '2027-01' && IT.leerTarjetaInforme({ ...tj, autor: 'atleta' }) === null
    && IT.leerTarjetaInforme({ ...tj, sesion_id: 's' }) === null && IT.leerTarjetaInforme({ ...tj, archivo_id: 'a', adjunto: true }) === null && IT.leerTarjetaInforme({ ...tj, eliminado_en: 'x' }) === null
    && IT.leerTarjetaInforme({ ...tj, texto: 'Tu informe de técnica de octubre de 2026 y más' }) === null && IT.leerTarjetaInforme({ ...tj, texto: 'Tu informe de técnica de brumario de 2026' }) === null,
    'la tarjeta: solo un mensaje del coach en el chat con ese texto exacto (no del atleta, ni en una sesión, ni con archivo, ni eliminado)');
  // La política: lo nuevo, en la 2026-12.3
  const PV3 = await import('../web/src/logica/privacidad.js');
  const legal4 = await import('../web/src/legal.js');
  const tv4 = legal4.PRIVACIDAD.find((x) => x[0] === 'Tus vídeos de técnica')[1];
  const mov4 = legal4.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  check(PV3.compararVersiones(legal4.VERSION_LEGAL, '2026-12.3') >= 0 && PV3.NOVEDADES_PRIVACIDAD.some((x) => x[3] === '2026-12.3') && PV3.novedadesDesde('2026-12.2', '2026-12.3').length === 1
    && /resumen de toda la sesión/.test(tv4) && /informe de técnica de cada mes/.test(tv4) && /sin guardarlo/.test(tv4) && /solo con wifi/.test(mov4) && /tipo de conexión/.test(mov4),
    'la política 2026-12.3: el resumen de la sesión, el informe del mes (calculado, sin guardarse), el perfil y «solo con wifi» (en el móvil)');
}

console.log('\nv0.62: avisar aunque bloquees el móvil (la pista del descanso) y el descanso en la pantalla de bloqueo');
{
  const PI = await import('../web/src/logica/pista.js');
  const { CLIPS, VOCES } = await import('../web/src/datos/pista-descanso.js');
  const { SONIDOS } = await import('../web/src/datos/sonidos-descanso.js');
  const AC = await import('../web/src/logica/actividad.js');
  const { normalizarAjustes, AJUSTES_DEFECTO } = await import('../web/src/ui/ajustes.js');
  const B = PI.FORMATO_PISTA.bytes;
  // ---------- el formato de las tramas
  const sil = PI.tramaSilencio();
  check(B === 144 && PI.FORMATO_PISTA.ms === 24 && sil.length === 144 && PI.esTrama(sil, 0) && sil.subarray(4).every((x) => x === 0),
    'una trama en silencio: MPEG-1 capa III, 48 kHz, mono, 48 kbit/s (144 bytes, 24 ms), con la información lateral a cero');
  const info = PI.tramaSilencio(); info.set([...'Info'].map((c) => c.charCodeAt(0)), 21);
  const sucio = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 3, 1, 2, 3, ...info, 7, 7, ...sil, ...sil]);
  check(PI.tramasDe(sucio).length === 2 * B && PI.tramasDe(new Uint8Array(50)).length === 0,
    'de un MP3 solo se quedan las tramas del formato: sin la etiqueta ID3, sin la trama «Info» de LAME (mentiría la duración) y sin basura');
  const dec = (v) => new Uint8Array(Buffer.from(v, 'base64'));
  const datos = Object.fromEntries(Object.entries(CLIPS).map(([k, v]) => [k, dec(v)]));
  const tramasOk = (d) => d.length > 0 && d.length % B === 0 && Array.from({ length: d.length / B }, (_, i) => PI.esTrama(d, i * B)).every(Boolean) && ((d[4] << 1) | (d[5] >> 7)) === 0;
  check(Object.keys(SONIDOS).every((k) => k in CLIPS) && 'suave' in CLIPS && 'pitido' in CLIPS && Object.values(datos).every(tramasOk) && Object.keys(VOCES).length === 0,
    `los sonidos de la pista (los ${Object.keys(SONIDOS).length} de FBE Timer, el suave y el pitido de la cuenta): tramas enteras del formato, la primera sin depender de otra; sin frases del coach grabadas`);
  check(datos.pitido.length / B <= 8 && Object.keys(SONIDOS).every((k) => datos[k].length / B * 24 < 2500), 'el pitido de la cuenta dura menos de 0,2 s y ningún aviso pasa de 2,5 s (cabe antes del final de la pista)');
  const largos = Object.fromEntries(Object.entries(datos).map(([k, d]) => [k, d.length / B]));
  // ---------- el plan: qué suena y cuándo
  const p10 = PI.planPista({ restanteMs: 10000, clips: largos, sonido: 'boxeo' });
  const inicios = []; let t = 0; for (const [k, n] of p10.partes) { if (k) inicios.push([k, t]); t += n; }
  check(p10.cue === 417 && Math.abs(p10.cueMs - 10000) <= 12 && p10.final.join() === 'boxeo' && inicios.map(([k]) => k).join() === 'pitido,pitido,pitido,boxeo'
    && inicios.slice(0, 3).every(([, x], i) => Math.abs(x * 24 - (7000 + i * 1000)) <= 24) && p10.total === t && p10.duracionMs === t * 24 && p10.partes.at(-1)[0] === null,
    'con 10 s: silencio, un pitido a los 3, 2 y 1 s del final, el aviso elegido justo al acabar (a ±12 ms; los pitidos, a una trama) y un poco de silencio detrás');
  check(PI.planPista({ restanteMs: 10000, clips: largos, cuentaAtras: false }).partes.filter(([k]) => k).map(([k]) => k).join() === 'tres-beeps'
    && PI.planPista({ restanteMs: 2000, clips: largos }).partes.filter(([k]) => k === 'pitido').length === 2
    && PI.planPista({ restanteMs: 0, clips: largos }) === null && PI.planPista({ restanteMs: PI.MAX_PISTA_MS + 1, clips: largos }) === null
    && PI.planPista({ restanteMs: 5000, clips: largos, sonido: 'inventado' }).final.join() === 'tres-beeps' && PI.planPista({ restanteMs: 5000, clips: largos, sonido: 'suave' }).final.join() === 'suave',
    'sin «Pitidos en los 3 últimos segundos», solo el aviso; con 2 s, solo los pitidos que caben; sin tiempo o con más de 15 min, sin pista; un aviso que no existe, los tres beeps');
  const voces = { fin: 40, vamos: 25, ultima: 30, tres: 60, dos: 20, uno: 20 };
  const pv = PI.planPista({ restanteMs: 10000, clips: largos, voz: true, voces, ultima: true });
  const iv = []; t = 0; for (const [k, n] of pv.partes) { if (k) iv.push([k, t, n]); t += n; }
  check(pv.final.join() === 'fin,ultima' && iv.map(([k]) => k).join() === 'tres,dos,uno,fin,ultima' && iv.every(([, x, n], i) => i === 0 || x >= iv[i - 1][1] + iv[i - 1][2])
    && iv[1][1] === iv[0][1] + 60 && pv.cue === iv[3][1] && pv.cue >= 417
    && PI.planPista({ restanteMs: 10000, clips: largos, voz: true, voces }).final.join() === 'fin,vamos'
    && PI.planPista({ restanteMs: 10000, clips: largos, voz: true, voces: { ...voces, uno: 0 } }).final.join() === 'tres-beeps'
    && PI.planPista({ restanteMs: 10000, clips: largos, voz: false, voces }).final.join() === 'tres-beeps',
    'con las seis frases del coach y la voz encendida: su «tres, dos, uno», «Se acabó el descanso» y «Última serie» (o «¡Vamos!»), sin pisarse (si una no cabe, va justo detrás); sin las seis o sin la voz, los pitidos y el aviso');
  // ---------- componerla
  const bytes = PI.componerPista(p10, datos);
  const enTrama = (i) => bytes.subarray(i * B, (i + 1) * B);
  check(bytes.length === p10.total * B && enTrama(0).every((x, i) => x === sil[i]) && enTrama(p10.cue).every((x, i) => x === datos.boxeo[i])
    && Array.from({ length: p10.total }, (_, i) => PI.esTrama(bytes, i * B)).every(Boolean),
    `la pista de 10 s: ${(bytes.length / 1024).toFixed(0)} KB de tramas del formato, en silencio hasta el aviso, que empieza en su trama (un descanso de 3 min, unos ${Math.round(180000 / 24 * B / 1024)} KB)`);
  // (revisión L2) la pista, en trozos: el silencio reutiliza un mismo bloque de 6 s, sin un array del tamaño de la pista
  const tz = PI.trozosPista(p10, datos), p15 = PI.planPista({ restanteMs: 15 * 60000 - 2000, clips: largos }), t15 = PI.trozosPista(p15, datos);
  const unidos = new Uint8Array(tz.reduce((n, x) => n + x.length, 0)); { let i = 0; for (const x of tz) { unidos.set(x, i); i += x.length; } }
  const total15 = t15.reduce((n, x) => n + x.length, 0);
  check(unidos.every((x, i) => x === bytes[i]) && total15 === p15.total * B && Math.abs(total15 / 1024 / 1024 - 5.15) < 0.1 && Math.max(...t15.map((x) => x.length)) <= 250 * B
    && new Set(t15.filter((x) => x.length === 250 * B).map((x) => x.buffer)).size === 1,
    `(revisión L2) en trozos para el Blob, igual que seguida; una de 15 min (${(total15 / 1024 / 1024).toFixed(1)} MB) se arma con ${t15.length} trozos de como mucho 36 KB que comparten el mismo bloque de silencio`);
  check(PI.avisoSonando(10, p10) && PI.avisoSonando(9.97, p10) && !PI.avisoSonando(9.9, p10) && !PI.avisoSonando(NaN, p10) && !PI.avisoSonando(11, null),
    'se sabe que el aviso ya suena cuando la pista llega a él (para anular el aviso al móvil)');
  // ---------- el descanso: ±15 s, pausa y seguir (la misma cuenta que el temporizador)
  const T0 = 1_000_000_000_000;
  const d = { fin: T0 + 30000, total: 90, texto: 'serie 2 de press banca', inicio: T0 - 60000 };
  const a15 = PI.ajustarDescanso(d, 15, T0), m15 = PI.ajustarDescanso({ ...d, fin: T0 + 10000 }, -15, T0), tras = PI.ajustarDescanso({ ...d, fin: T0 - 2000 }, 15, T0);
  check(a15.fin === T0 + 45000 && a15.total === 90 && a15.texto === d.texto && a15.inicio === d.inicio && m15.fin === T0 - 5000 && tras.fin === T0 + 15000 && tras.total === 90
    && PI.ajustarDescanso(d, 60, T0).fin === T0 + 90000 && PI.ajustarDescanso({ ...d, total: 20 }, 15, T0).total === 45,
    '+15 / −15 / +1 min como el temporizador (desde ahora si ya había acabado; el total crece si hace falta), sin perder lo demás del descanso');
  const pa = PI.pausarDescanso(d, T0 + 10000), si = PI.reanudarDescanso(pa, T0 + 50000);
  check(pa.pausa === 20000 && pa.pausadoEn === T0 + 10000 && !('pausadoEn' in si) && !('pausadoEn' in PI.ajustarDescanso(pa, -60, T0)) && PI.enPausa(pa) && PI.restanteMs(pa, T0 + 99999) === 20000 && PI.ajustarDescanso(pa, 15, T0).pausa === 35000 && PI.ajustarDescanso(pa, -60, T0).pausa === null && PI.ajustarDescanso(pa, -60, T0).fin === T0
    && si.fin === T0 + 70000 && !('pausa' in si) && PI.pausarDescanso({ ...d, fin: T0 - 1 }, T0).pausa === undefined && PI.reanudarDescanso(d, T0) === d && PI.restanteMs(d, T0) === 30000 && PI.restanteMs(null) === 0,
    'pausa (desde la pantalla de bloqueo): se queda con lo que faltaba (y cuándo se pausó), ±15 lo cambia (si llega a cero, acaba) y «Seguir» lo continúa desde ahora; uno ya acabado no se pausa');
  check(PI.MAX_PAUSA_MS === 30 * 60000 && PI.pausaVigente(pa, T0 + 10000 + 29 * 60000) && !PI.pausaVigente(pa, T0 + 10000 + 31 * 60000) && !PI.pausaVigente({ ...pa, pausadoEn: undefined }, T0 + 20000)
    && !PI.pausaVigente(d, T0) && !PI.pausaVigente(pa, T0),
    '(revisión M2) una pausa vale media hora: después (o sin saber cuándo se pausó) ya no vuelve sola días después');
  // (revisión M1) el aviso al móvil tras un botón de la pantalla de bloqueo, con la sesión cerrada
  const a1 = PI.avisoTrasCambio(PI.ajustarDescanso({ ...d, fin: T0 + 10000 }, -15, T0), T0);
  const a2 = PI.avisoTrasCambio(PI.reanudarDescanso(pa, T0 + 60000), T0 + 60000);
  const a3 = PI.avisoTrasCambio(PI.ajustarDescanso(d, 15 * 60, T0), T0);
  check(a1.programar === T0 && !a1.cancelar && PI.avisoTrasCambio({ fin: T0 - 5000 }, T0, { visible: true }).cancelar === true && a2.programar === T0 + 80000
    && a3.programar === T0 + 30000 + 15 * 60000 && PI.avisoTrasCambio(pa, T0).cancelar && PI.avisoTrasCambio(null, T0).cancelar,
    '(revisión M1) −15 con 10 s: avisa ya (no al final de antes); al seguir tras una pausa, para el final nuevo (aunque la pista no arranque); ⏩ más allá de la pista: para su final de verdad; en pausa o saltado, se anula; acabado con la app delante, avisa ella');
  // ---------- la pantalla de bloqueo
  check(PI.tituloMedia({ restanteS: 83 }) === 'Descanso · 1:23' && PI.tituloMedia({ restanteS: 83, pausa: true }) === 'Descanso en pausa · 1:23' && PI.tituloMedia({ restanteS: 83, oculta: true }) === 'Descanso'
    && PI.tituloMedia({ restanteS: 83, oculta: true, pausa: true }) === 'Descanso en pausa · 1:23' && PI.tituloMedia({ restanteS: 0 }) === '¡Vamos!' && PI.tituloMedia({ restanteS: 10, prueba: true }) === 'Prueba del aviso · 0:10',
    'el título de la pantalla de bloqueo: «Descanso · 1:23» (con la página oculta, sin la cifra, que se quedaría parada: ya la da la barra), «en pausa» y «¡Vamos!»');
  check(JSON.stringify(PI.posicionMedia({ total: 90, restanteS: 30 })) === '{"duration":90,"position":60,"playbackRate":1}' && JSON.stringify(PI.posicionMedia({ total: 90, restanteS: 120 })) === '{"duration":120,"position":0,"playbackRate":1}'
    && PI.posicionMedia({ total: 90, restanteS: 30, pausa: true }).playbackRate === 1 && PI.posicionMedia({ total: 0, restanteS: 0 }).duration === 1
    && PI.albumMedia('serie 3 de press banca · 80 kg × 6') === 'Después: serie 3 de press banca · 80 kg × 6' && PI.albumMedia(null) === '',
    'la barra de progreso (lo que va de descanso sobre el total; nunca más allá del final; la velocidad, siempre 1: con 0 setPositionState falla, la pausa la dice playbackState) y «Después: …» debajo');
  // ---------- lo que se dice y lo que lleva el aviso al móvil
  const ult = 'Serie 3 de press banca: 80 kilos por 6. Última serie.';
  check(PI.esUltima(ult) && !PI.esUltima('Serie 2 de press banca: 80 kilos por 6.') && PI.fraseTrasPista(ult, ['fin', 'ultima']) === 'Serie 3 de press banca: 80 kilos por 6.' && PI.fraseTrasPista(ult, ['boxeo']) === ult
    && PI.fraseTrasPista(null, ['fin', 'vamos']) === '' && PI.fraseTrasPista('', ['boxeo']) === '¡Vamos!' && PI.fraseTrasPista('¡Sesión terminada! Buen trabajo.', ['fin', 'vamos']) === '¡Sesión terminada! Buen trabajo.',
    'si la página sigue viva al acabar, la voz del móvil dice la serie siguiente sin repetir lo que acaba de decir la pista («Última serie», «¡Vamos!»): nunca dos veces');
  check(PI.textoAviso({ texto: 'serie 3 de press banca', kg: 80, reps: 6 }) === 'serie 3 de press banca · 80 kg × 6' && PI.textoAviso({ texto: 'serie 3 de press banca', kg: 82.5 }) === 'serie 3 de press banca · 82,5 kg'
    && PI.textoAviso({ texto: 'dominadas', reps: 8 }) === 'dominadas · 8 reps' && PI.textoAviso({ texto: 'terminar la sesión' }) === 'terminar la sesión' && PI.textoAviso({ texto: '' }) === '' && PI.textoAviso({ texto: 'x'.repeat(200), kg: 50, reps: 5 }).length === 150,
    'el aviso al móvil del fin del descanso, con la carga que le propone si se sabe («Ahora: serie 3 de press banca · 80 kg × 6»), sin pasar de 150 caracteres');
  // ---------- dónde sale el ajuste
  const IPH = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  check(PI.plataformaPista({ ua: IPH, audioSession: true }) === 'ios' && PI.plataformaPista({ ua: IPH, audioSession: false, mediaSession: true }) === null
    && PI.plataformaPista({ ua: MAC, plataforma: 'MacIntel', toques: 5, audioSession: true }) === 'ios' && PI.plataformaPista({ ua: MAC, plataforma: 'MacIntel', toques: 0, audioSession: true, mediaSession: true }) === null
    && PI.plataformaPista({ ua: AND, mediaSession: true }) === 'android' && PI.plataformaPista({ ua: AND, mediaSession: false }) === null && PI.plataformaPista({ ua: IPH, audioSession: true, audio: false }) === null,
    'el ajuste sale solo donde puede funcionar: iPhone o iPad con Safari 16.4+ (audioSession) y Android con Media Session; en el ordenador, no');
  check(AJUSTES_DEFECTO.vozBloqueo === false && normalizarAjustes({}).vozBloqueo === false && normalizarAjustes({ vozBloqueo: true }).vozBloqueo === true && normalizarAjustes({ vozBloqueo: 'si' }).vozBloqueo === false,
    '«Avisar aunque bloquees el móvil», apagado de serie en cada móvil (quien no lo enciende sigue como siempre, en «ambient»)');
  // ---------- la píldora y lo que se guarda
  const g = AC.descansoGuardable({ ...pa, prioridad: 'alta', aviso: 'serie 2 de press banca · 80 kg × 6', extra: 'no' });
  const enC = { id: 's1', nombre: 'Torso', hechas: 3, t: T0, descanso: g };
  const ea = AC.estadoActividad(enC, T0 + 300000);
  check(g.pausa === 20000 && g.pausadoEn === T0 + 10000 && g.aviso.endsWith('× 6') && !('extra' in g) && AC.descansoGuardable(null) === null && AC.descansoGuardable({ ...d }).pausa === null
    && ea.descanso.pausa && ea.descanso.quedan === 20 && ea.descanso.cuenta === '0:20' && !ea.descanso.terminado && /en pausa/.test(AC.etiquetaActividad(ea))
    && AC.estadoActividad({ ...enC, descanso: AC.descansoGuardable(d) }, T0 + 300000).descanso === null,
    'la píldora «Sesión en curso» guarda el aviso y la pausa (nada más) y, en pausa, enseña lo que quedaba, quieto, aunque pase el tiempo');
  check(AC.estadoActividad({ ...enC, t: T0 + 1900000 }, T0 + 1900000 + 1000).descanso === null && AC.estadoActividad({ ...enC, descanso: { ...g, pausadoEn: null } }, T0 + 20000).descanso === null
    && AC.descansoGuardable(d).pausadoEn === null,
    '(revisión M2) una pausa de hace más de media hora (o sin su hora) ya no sale en la píldora ni vuelve a la sesión');
  // ---------- la política
  const legal5 = await import('../web/src/legal.js');
  const PV4 = await import('../web/src/logica/privacidad.js');
  const mov5 = legal5.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  const not5 = legal5.PRIVACIDAD.find((x) => x[0] === 'Notificaciones')[1];
  check(PV4.compararVersiones(legal5.VERSION_LEGAL, '2026-12.4') >= 0 && PV4.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.4') && PV4.novedadesDesde('2026-12.3', '2026-12.4').length === 1
    && /Avisar aunque bloquees el móvil/.test(mov5) && /pantalla de bloqueo/.test(mov5) && /a la vista de cualquiera/.test(mov5) && /no sale de él/.test(mov5) && /carga que te propone/.test(not5)
    && /lo ve quien mire tu móvil/.test(PV4.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.4')[2]) && /pantalla del coche, el reloj u otro aparato Bluetooth/.test(mov5),
    'la política 2026-12.4: el ajuste se queda en el móvil, la pantalla de bloqueo enseña el descanso y la serie siguiente (a la vista de quien mire el móvil) y el aviso lleva la carga');
}

// ---------------------------------------------------------------- v0.63: apuntar las series (teclado, propagar, deslizar, «Ahora toca»)
console.log('\nv0.63: el teclado de la app, el cambio que pasa a las series siguientes, deslizar y «Ahora toca»');
{
  const TE = await import('../web/src/logica/teclado.js');
  const PR = await import('../web/src/logica/propagar.js');
  const DE = await import('../web/src/logica/deslizar.js');
  const AT = await import('../web/src/logica/ahora-toca.js');
  const { discosPorLado, trasSerie } = await import('../web/src/logica/calculos.js');
  const { normalizarAjustes, AJUSTES_DEFECTO } = await import('../web/src/ui/ajustes.js');
  // ---------- el salto de −/+ por el material y los discos de ese gimnasio
  check(TE.tipoCarga('Press banca') === 'discos' && TE.tipoCarga('Sentadilla trasera con barra') === 'discos' && TE.tipoCarga('Prensa de piernas') === 'discos' && TE.tipoCarga('Sentadilla en multipower') === 'discos'
    && TE.tipoCarga('Press inclinado con mancuernas') === 'mancuernas' && TE.tipoCarga('Sentadilla búlgara') === 'mancuernas' && TE.tipoCarga('Swing con kettlebell') === 'kettlebell'
    && TE.tipoCarga('Jalón al pecho') === 'maquina' && TE.tipoCarga('Remo en polea baja') === 'maquina' && TE.tipoCarga('Curl femoral tumbado') === 'maquina' && TE.tipoCarga('Dominadas pronas') === null && TE.tipoCarga('') === null,
    'cómo se carga cada ejercicio, por su nombre: con discos (barra, multipower, prensa), mancuernas, kettlebell, máquina o polea; si no se sabe, nada');
  check(TE.pasoKg({ nombre: 'Press banca' }) === 2.5 && TE.pasoKg({ nombre: 'Press banca', discoMinimo: 0.5 }) === 1 && TE.pasoKg({ nombre: 'Press banca', discoMinimo: 1 }) === 2
    && TE.pasoKg({ nombre: 'Press banca', discoMinimo: 2.5 }) === 5 && TE.pasoKg({ nombre: 'Press banca', discoMinimo: 3 }) === 2.5 && TE.pasoKg({ nombre: 'Prensa de piernas', discoMinimo: 1.25 }) === 2.5,
    'con discos, −/+ es dos veces el disco más pequeño de ese gimnasio (uno por lado): ±2,5 con discos de 1,25; ±1 con fraccionados de 0,5; un disco que no es de la lista, el de serie');
  check(TE.pasoKg({ nombre: 'Curl con mancuernas', kg: 8 }) === 1 && TE.pasoKg({ nombre: 'Curl con mancuernas', kg: 20 }) === 2 && TE.pasoKg({ nombre: 'Swing con kettlebell', kg: 16 }) === 4
    && TE.pasoKg({ nombre: 'Jalón al pecho', kg: 40 }) === 2.5 && TE.pasoKg({ nombre: 'Jalón al pecho', kg: 60 }) === 5 && TE.pasoKg({ nombre: 'Dominadas lastradas', kg: 10 }) === 2.5 && TE.pasoKg() === 2.5,
    'mancuernas de 2 en 2 (de 1 en 1 por debajo de 10 kg), kettlebells de 4 en 4, máquinas y poleas como propone la app (2,5; 5 desde 50 kg) y, sin saber qué es, ±2,5');
  check(igual(TE.discosCon(1.25), [25, 20, 15, 10, 5, 2.5, 1.25]) && igual(TE.discosCon(2.5), [25, 20, 15, 10, 5, 2.5]) && TE.discosCon(0.5).includes(0.5) && TE.discosCon(0.5).includes(1)
    && igual(discosPorLado(101, 20, TE.discosCon(0.5)), [25, 15, 0.5]) && discosPorLado(101) === null && discosPorLado(100, 20, TE.discosCon(2.5)) && discosPorLado(102.5, 20, TE.discosCon(2.5)) === null
    && igual(discosPorLado(62.5), [20, 1.25]),
    'los discos por lado, con los que hay en ese gimnasio: 101 kg con fraccionados (25 + 15 + 0,5), que con los de siempre no se puede; sin los de 1,25, 102,5 tampoco (los de siempre, igual que antes)');
  check(TE.DISCOS_MINIMOS.every(TE.discoMinimoValido) && !TE.discoMinimoValido(0.25) && !TE.discoMinimoValido('x') && TE.DISCO_MINIMO_DEFECTO === 1.25,
    'el disco más pequeño, de una lista (0,5, 1, 1,25 o 2,5); de serie, 1,25');
  // ---------- el orden de «Siguiente»
  check(igual(TE.ordenCampos(), ['kg', 'reps', 'hecho']) && igual(TE.ordenCampos({ conRpe: true }), ['kg', 'reps', 'rpe', 'hecho'])
    && TE.siguienteCampo('kg') === 'reps' && TE.siguienteCampo('reps') === 'hecho' && TE.siguienteCampo('reps', { conRpe: true }) === 'rpe' && TE.siguienteCampo('rpe', { conRpe: true }) === 'hecho'
    && TE.siguienteCampo('rpe') === 'hecho' && TE.siguienteCampo('hecho', { conRpe: true }) === 'hecho',
    '«Siguiente»: kilos → repeticiones → RPE (solo si tu coach lo pide) → marcar la serie; el RPE abierto a mano, a marcar');
  check(TE.pideRpe({ rpe_objetivo: 8 }) && TE.pideRpe({ rir_objetivo: 2 }) && TE.pideRpe({}, { rpe: 7.5 }) && !TE.pideRpe({}) && !TE.pideRpe(null) && !TE.pideRpe({ rpe_objetivo: null }, { reps: 8 }),
    'tu coach pide el esfuerzo si pone un RPE o un RIR objetivo (en la pauta o en esa serie)');
  // ---------- las teclas
  const K = (t, k, o) => TE.pulsarTecla(t, k, o);
  check(K('', '4') === '4' && K('42', '5') === '425' && K('42', ',') === '42,' && K('42,5', ',') === '42,5' && K('42,55', '1') === '42,55' && K('', ',') === '0,' && K('0', '5') === '5'
    && K('150', '1') === '150' && K('1500', '0') === '1500' && K('9999', '9') === '9999' && K('42,5', 'x') === '42,5' && K(null, '7') === '7',
    'los kilos: cifras, una sola coma y hasta dos decimales, sin pasar de 1500 (lo que no vale no se escribe)');
  check(K('8', ',', { campo: 'reps' }) === '8' && K('20', '0', { campo: 'reps' }) === '200' && K('200', '1', { campo: 'reps' }) === '200' && K('201', '', { campo: 'reps' }) === '201' && K('12', '3', { campo: 'reps' }) === '123' && K('123', '4', { campo: 'reps' }) === '123',
    'las repeticiones: enteras (sin coma) y hasta 200');
  check(K('42,5', '7', { nuevo: true }) === '7' && K('42,5', 'borrar', { nuevo: true }) === '' && K('42,5', 'borrar') === '42,' && K('', 'borrar') === '' && K('8', ',', { campo: 'reps', nuevo: true }) === '8'
    && K('42,5', ',', { nuevo: true }) === '0,',
    'al abrir el campo (o tras −/+), lo que se teclea sustituye a lo que hay, como al seleccionarlo; borrar lo deja vacío');
  check(TE.sumarPaso('', 60, 2.5) === '62,5' && TE.sumarPaso('60', null, -2.5) === '57,5' && TE.sumarPaso('1', null, -2.5) === '0' && TE.sumarPaso('42,5', 0, 2.5) === '45' && TE.sumarPaso('', null, 2.5) === '2,5'
    && TE.sumarPaso('1499', null, 5) === '1500' && TE.sumarPaso('', 8, 1, 'reps') === '9' && TE.sumarPaso('', null, -1, 'reps') === '0' && TE.sumarPaso('8', 10, -1, 'reps') === '7' && TE.sumarPaso('', 16, 2) === '18',
    '−/+ suman a lo escrito o, si está vacío, a lo que te propone (el gris); nunca por debajo de 0 ni por encima del tope; con coma');
  check(TE.anuncioValor('kg', '42,5') === 'Kilos: 42,5' && TE.anuncioValor('reps', '') === 'Repeticiones: vacío' && TE.anuncioValor('rpe', 8.5) === 'RPE: 8,5' && TE.anuncioValor('rpe', '') === 'RPE: vacío'
    && igual(TE.RPE_TECLADO, [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]),
    'cada cambio se anuncia al lector de pantalla («Kilos: 42,5»); el RPE, del 6 al 10 de medio en medio');
  check(AJUSTES_DEFECTO.tecladoApp === true && normalizarAjustes({}).tecladoApp === true && normalizarAjustes({ tecladoApp: false }).tecladoApp === false && normalizarAjustes({ tecladoApp: 'no' }).tecladoApp === true,
    'el teclado de la app, encendido de serie en cada móvil (apagado, el del móvil, como antes)');
  // ---------- el cambio que pasa a las series siguientes
  const F = (over = {}) => [1, 2, 3, 4].map((n) => ({ numero: n, hecha: false, pautada: true, tipo: null, prescrito: 60, texto: '', ...(over[n] || {}) }));
  const nums = (cs) => cs.map((c) => c.numero).join();
  const c1 = PR.propagarCambio(F(), 1, '', '62,5');
  check(nums(c1) === '2,3,4' && c1.every((c) => c.antes === '' && c.despues === '62,5'), 'subir la primera serie (3 × 60 kg → 62,5) pasa a las siguientes sin hacer que llevaban lo mismo');
  check(nums(PR.propagarCambio(F({ 2: { hecha: true } }), 1, '', '62,5')) === '3,4' && nums(PR.propagarCambio(F({ 3: { texto: '65' } }), 1, '', '62,5')) === '2,4'
    && nums(PR.propagarCambio(F({ 4: { prescrito: 55 } }), 1, '', '62,5')) === '2,3' && nums(PR.propagarCambio(F({ 4: { pautada: false } }), 1, '', '62,5')) === '2,3',
    'nunca toca las hechas, las que ya habías cambiado a otra cosa, las que tienen otra pauta (otros kilos) ni las de más');
  check(PR.propagarCambio(F({ 1: { tipo: 'top' }, 2: { tipo: 'backoff' }, 3: { tipo: 'backoff' }, 4: { tipo: 'backoff' } }), 1, '', '62,5').length === 0
    && nums(PR.propagarCambio(F({ 1: { tipo: 'top' }, 2: { tipo: 'backoff', prescrito: 54 }, 3: { tipo: 'backoff', prescrito: 54 } }), 2, '', '55')) === '3',
    'la top no cambia sus back-off (otra pauta); una back-off sí cambia las siguientes back-off iguales');
  check(nums(PR.propagarCambio(F(), 2, '', '62,5')) === '3,4' && PR.propagarCambio(F({ 1: { hecha: true } }), 1, '60', '62,5').length === 0 && PR.propagarCambio(F(), 1, '', '60').length === 0
    && PR.propagarCambio(F(), 1, '60', '').length === 0 && PR.propagarCambio(F(), 9, '', '1').length === 0 && PR.propagarCambio(F({ 1: { pautada: false } }), 1, '', '62,5').length === 0,
    'solo hacia delante; nada si la cambiada ya está hecha, si el valor no cambia (escribir lo mismo que el gris) o si es una de más');
  const conProp = F({ 2: { texto: '62,5' }, 3: { texto: '62,5' }, 4: { texto: '62,5' } });
  check(nums(PR.propagarCambio(conProp, 1, '62,5', '')) === '2,3,4' && PR.propagarCambio(conProp, 1, '62,5', '').every((c) => c.despues === '')
    && nums(PR.propagarCambio(F({ 1: { prescrito: 8 }, 2: { prescrito: 8 }, 3: { prescrito: 10 } }), 1, '', '6')) === '2',
    'volver la primera a lo propuesto (vaciarla) también vuelve las que había cambiado; con las repeticiones, lo mismo (3 × 8 → 6, no la de 10)');
  const b0 = { 1: { kg: '62,5', reps: '' }, 2: { kg: '', reps: '8' }, 3: { kg: '', reps: '' } };
  const cambios = PR.propagarCambio(F(), 1, '', '62,5');
  const b1 = PR.aplicarPropagacion(b0, 'kg', cambios);
  check(b1[2].kg === '62,5' && b1[2].reps === '8' && b1[3].kg === '62,5' && b1[4].kg === '62,5' && b1[1].kg === '62,5' && b0[2].kg === '' && b0[3].kg === '',
    'aplicarla cambia solo ese campo de esas series (las repeticiones escritas se quedan) y no toca lo de antes');
  const b2 = PR.deshacerPropagacion(b1, 'kg', cambios);
  check(b2[2].kg === '' && b2[3].kg === '' && b2[4].kg === '' && b2[2].reps === '8' && b2[1].kg === '62,5',
    '«Deshacer» vuelve cada serie exactamente a lo que tenía (también vacío) y deja la cambiada como la dejaste');
  const b3 = PR.deshacerPropagacion({ ...b1, 3: { ...b1[3], kg: '70' } }, 'kg', cambios);
  check(b3[3].kg === '70' && b3[2].kg === '' && b3[4].kg === '', 'y no pisa una serie que has vuelto a cambiar después');
  check(PR.textoPropagacion([3, 4]) === 'También en las series 3 y 4' && PR.textoPropagacion([3]) === 'También en la serie 3' && PR.textoPropagacion([4, 2, 3]) === 'También en las series 2, 3 y 4' && PR.textoPropagacion([]) === '',
    'el aviso: «También en las series 3 y 4 · Deshacer»');
  // ---------- deslizar
  check(DE.ejeGesto(3, 4) === null && DE.ejeGesto(12, 2) === 'x' && DE.ejeGesto(2, 12) === 'y' && DE.ejeGesto(12, 11) === 'y' && DE.ejeGesto(-15, 3) === 'x' && DE.BLOQUEO_PX === 10,
    'hasta 10 px no se sabe; luego se fija el eje (en diagonal, gana la página)');
  check(DE.umbralDeslizar(360) === 126 && DE.umbralDeslizar(100) === 72 && DE.umbralDeslizar(600) === 140 && DE.umbralDeslizar(0) === 112,
    'el umbral: el 35 % del ancho de la fila, entre 72 y 140 px');
  const d1 = DE.estadoDeslizar(50, 360), d2 = DE.estadoDeslizar(130, 360), d3 = DE.estadoDeslizar(-40, 360), d4 = DE.estadoDeslizar(1000, 360);
  check(d1.x === 50 && !d1.pasado && d2.pasado && d2.progreso === 1 && d3.x === 0 && !d3.pasado && d4.x <= 288 && d4.x > 126 && DE.estadoDeslizar(100, 360).progreso < 1,
    'la fila sigue al dedo hasta el umbral y luego con resistencia (sin salirse); hacia la izquierda no se mueve');
  check(DE.cruceUmbral(false, true) === 'entra' && DE.cruceUmbral(true, false) === 'sale' && DE.cruceUmbral(true, true) === null && DE.cruceUmbral(false, false) === null,
    'un toque de vibración al cruzar el umbral (y volviendo atrás se cancela)');
  check(DE.sigueLarga(3, 4) && !DE.sigueLarga(6, 6) && DE.LARGA_MS === 500, 'la pulsación larga: medio segundo sin moverse más de 8 px');
  // ---------- «Ahora toca»
  const EJ = [{ id: 'a', series: 3, ejercicio: { nombre: 'Press banca' }, rpe_objetivo: 8 }, { id: 'b', series: 2, ejercicio: { nombre: 'Remo con barra' }, rir_objetivo: 2, notas_coach: 'Pausa abajo' }];
  check(igual(AT.serieQueToca(EJ, { a: { 1: {}, 2: {} } }), { id: 'a', numero: 3 }) && igual(AT.serieQueToca(EJ, { a: { 1: {} } }, { id: 'b', numero: 1 }), { id: 'b', numero: 1 })
    && igual(AT.serieQueToca(EJ, { a: { 1: {} }, b: { 1: {} } }, { id: 'b', numero: 1 }), { id: 'a', numero: 2 }) && igual(AT.serieQueToca(EJ, {}, { id: 'a', numero: 4 }), { id: 'a', numero: 1 })
    && AT.serieQueToca(EJ, {}, null, { completada: true }) === null && AT.serieQueToca(EJ, { a: { 1: 1, 2: 1, 3: 1 }, b: { 1: 1, 2: 1 } }) === null,
    'la serie que toca, la misma regla que la sesión y la píldora: la que dijo la última marcada si sigue sin hacer; si no, la primera sin hacer; nada al acabar');
  const opc = (o = {}) => ({ ejercicios: EJ, hechas: { a: { 1: {}, 2: {} } }, tras: 'a', propuestaDe: (se, k) => (se.id === 'a' ? { kg: 80, reps: 6 } : { kg: 60, reps: 10 }),
    ultimasDe: (se) => (se.id === 'a' ? { series: [{ numero: 3, kg: 77.5, reps: 6, rpe: 8 }] } : null), recordatoriosDe: (se) => (se.id === 'a' ? [{ texto: 'Codos a 45°' }] : []), barraDe: () => true, ...o });
  const t1 = AT.ahoraToca(opc());
  check(t1.id === 'a' && t1.numero === 3 && t1.serie === 'Serie 3 de 3' && t1.kg === 80 && t1.reps === 6 && t1.carga === '80 kg × 6' && t1.esfuerzo === 'RPE 8' && t1.anterior === '77,5×6 @8'
    && t1.nota === 'Codos a 45°' && t1.notaRecuerda && t1.discos && !t1.otroEjercicio && t1.nombre === 'Press banca'
    && t1.texto === 'Press banca, serie 3 de 3. 80 kg × 6. RPE 8. La última vez, 77,5×6 @8. Recuerda: Codos a 45°',
    `lo que viene: la serie, los kilos × repeticiones propuestos, el RPE objetivo, la última vez en esa serie, el «Recuerda» de tu coach y los discos («${t1.texto}»)`);
  const t2 = AT.ahoraToca(opc({ hechas: { a: { 1: {}, 2: {}, 3: {} } } }));
  check(t2.id === 'b' && t2.numero === 1 && t2.otroEjercicio && t2.esfuerzo === 'RIR 2' && t2.nota === 'Pausa abajo' && !t2.notaRecuerda && t2.anterior === null && /^Siguiente ejercicio, Remo con barra, serie 1 de 2/.test(t2.texto),
    'cuando lo siguiente es otro ejercicio, lo dice; con su RIR objetivo y, sin «Recuerda», la nota de tu coach');
  check(AT.ahoraToca(opc({ hechas: { a: { 1: 1, 2: 1, 3: 1 }, b: { 1: 1, 2: 1 } } })) === null && AT.ahoraToca(opc({ completada: true })) === null,
    'tras la última serie (o con la sesión terminada) no hay tarjeta');
  const t3 = AT.ahoraToca(opc({ propuestaDe: () => ({ kg: null, reps: 12, rpe: 7.5 }), barraDe: () => false }));
  check(t3.carga === '12 repeticiones' && t3.kg === null && t3.esfuerzo === 'RPE 7,5' && !t3.discos && AT.ahoraToca(opc({ propuestaDe: () => ({ kg: 20, reps: 5 }) })).discos === false
    && AT.ahoraToca(opc({ propuestaDe: () => { throw new Error('x'); } })).carga === null,
    'sin kilos (peso corporal), las repeticiones; el RPE de la serie pautada serie a serie manda; los discos solo con barra y más de 20 kg; si la propuesta falla, sin cifras');
  check(AT.nombreSerie({ series: 4, backoff_pct: 10 }, 1) === 'Serie top' && AT.nombreSerie({ series: 4, backoff_pct: 10 }, 3) === 'Back-off 2 de 3' && AT.nombreSerie({ series: 3 }, 4) === 'Serie 4 (de más)'
    && AT.objetivoEsfuerzo({ rir_objetivo: 1, rpe_objetivo: 9 }) === 'RIR 1' && AT.objetivoEsfuerzo({}) === null,
    'la top y sus back-off por su nombre; el RIR antes que el RPE de la pauta');
  // Superserie: la ronda A1 → A2 va sin descanso; al cerrarla, el descanso y «Ahora toca» vuelve a A1, serie 2
  const SS = [{ id: 'a1', series: 3, superserie: 'A', descanso_seg: 90, ejercicio: { nombre: 'Press militar' } }, { id: 'a2', series: 3, superserie: 'A', descanso_seg: 90, ejercicio: { nombre: 'Dominadas' } },
    { id: 'c', series: 2, descanso_seg: 60, ejercicio: { nombre: 'Curl' } }];
  const r1 = trasSerie(SS, { a1: 1, a2: 0, c: 0 }, 'a1');
  const r2 = trasSerie(SS, { a1: 1, a2: 1, c: 0 }, 'a2');
  const s2 = AT.ahoraToca({ ejercicios: SS, hechas: { a1: { 1: {} }, a2: { 1: {} } }, proxima: r2.siguiente, tras: 'a2', etiquetas: { a1: 'A1', a2: 'A2' }, propuestaDe: () => ({ kg: 40, reps: 8 }) });
  check(r1.enRonda && r1.descanso === 0 && r2.descanso === 90 && s2.id === 'a1' && s2.numero === 2 && s2.etiqueta === 'A1' && s2.otroEjercicio && /^Siguiente ejercicio, A1 Press militar, serie 2 de 3/.test(s2.texto),
    'en una superserie, tras la ronda (A1 y A2) el descanso y «Ahora toca» vuelve a A1, serie 2, con su etiqueta');
  const s3 = AT.ahoraToca({ ejercicios: SS, hechas: { a1: { 1: 1, 2: 1, 3: 1 }, a2: { 1: 1, 2: 1, 3: 1 } }, proxima: trasSerie(SS, { a1: 3, a2: 3, c: 0 }, 'a2').siguiente, tras: 'a2', propuestaDe: () => ({ kg: 12, reps: 12 }) });
  check(s3.id === 'c' && s3.numero === 1 && s3.otroEjercicio, 'acabada la superserie, el siguiente ejercicio');
  // (revisión L1) saltarse una serie: marcar la 1 y la 3 de 4. Contando las hechas, trasSerie diría la «3» (ya hecha); la regla
  // de la sesión dice la 2, y es la que usan ahora también la pantalla de bloqueo, el aviso al móvil y la voz
  const EJ4 = [{ id: 'x', series: 4, ejercicio: { nombre: 'Press banca' } }];
  const hSalto = { x: { 1: {}, 3: {} } };
  const tS = trasSerie(EJ4, { x: 2 }, 'x');
  check(tS.siguiente.numero === 3 && igual(AT.serieQueToca(EJ4, hSalto, tS.siguiente), { id: 'x', numero: 2 }) && AT.ahoraToca({ ejercicios: EJ4, hechas: hSalto, proxima: tS.siguiente }).numero === 2,
    'saltándose una serie (1 y 3 de 4), la siguiente es la 2 para la tarjeta, la píldora, la pantalla de bloqueo, el aviso y la voz (no la «3» de contar las hechas)');
  // ---------- la política
  const legal6 = await import('../web/src/legal.js');
  const PV5 = await import('../web/src/logica/privacidad.js');
  const mov6 = legal6.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  const nov5 = PV5.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.5');
  check(nov5 && PV5.novedadesDesde('2026-12.4', '2026-12.5').length === 1
    && /teclado de la app/.test(mov6) && /disco más pequeño/.test(mov6) && /no se guarda en ningún sitio hasta que la marcas/.test(mov6) && /solo en tu móvil/.test(nov5[2]),
    'la política 2026-12.5: el teclado elegido y el disco más pequeño de cada sitio se quedan en el móvil (lo escrito sin marcar, en ningún sitio)');
}

// ---------------------------------------------------------------- v0.64: «Máquina ocupada» y el orden de la sesión
console.log('\nv0.64: «Máquina ocupada» y el orden de la sesión');
{
  const OR = await import('../web/src/logica/orden-sesion.js');
  const AT = await import('../web/src/logica/ahora-toca.js');
  const { gruposSuperserie, etiquetasSuperserie, trasSerie } = await import('../web/src/logica/calculos.js');
  const { tramosSesion } = await import('../web/src/logica/tablero.js');
  const ids = (l) => l.map((e) => e.id).join(',');
  // ---------- 4. el orden: la superserie se mueve entera
  const SES = [
    { id: 'p', series: 3, ejercicio: { nombre: 'Press banca' } },
    { id: 'a1', series: 3, superserie: 'A', ejercicio: { nombre: 'Leg curl' } }, { id: 'a2', series: 3, superserie: 'A', ejercicio: { nombre: 'Gemelo' } },
    { id: 'r', series: 3, ejercicio: { nombre: 'Remo con barra' } },
    { id: 'c', series: 2, ejercicio: { nombre: 'Curl' } },
  ];
  const h0 = {};
  const o1 = OR.moverAlFinal(SES, h0, 'p');
  const l1 = OR.aplicarOrden(SES, o1);
  check(ids(l1) === 'a1,a2,r,c,p' && igual(etiquetasSuperserie(l1), { a1: 'A1', a2: 'A2' }) && SES[0].id === 'p' && !('_bloque' in SES[0]),
    '«Máquina ocupada»: el press pasa detrás de lo que queda; la superserie sigue entera (A1, A2) y la pauta del coach no se toca');
  const o2 = OR.moverAlFinal(SES, h0, 'a2');
  check(ids(OR.aplicarOrden(SES, o2)) === 'p,r,c,a1,a2', 'dejar para luego un ejercicio de una superserie mueve la superserie entera (nunca se parte)');
  // Con lo ya hecho: los bloques acabados se quedan en su sitio
  const hP = { p: { 1: {}, 2: {}, 3: {} }, a1: { 1: {} } };
  const o3 = OR.moverAlFinal(SES, hP, 'a1');
  check(ids(OR.aplicarOrden(SES, o3)) === 'p,r,c,a1,a2' && OR.moverAlFinal(SES, hP, 'p') === null && OR.moverAlFinal(SES, { p: { 1: 1, 2: 1, 3: 1 }, a1: { 1: 1, 2: 1, 3: 1 }, a2: { 1: 1, 2: 1, 3: 1 }, r: { 1: 1, 2: 1, 3: 1 } }, 'c') === null,
    'una superserie empezada también se puede dejar para luego; lo acabado no se mueve y el último que queda no tiene a dónde ir');
  check(OR.puedeDejarLuego(SES, hP, 'a1') && !OR.puedeDejarLuego(SES, hP, 'p'), 'se ofrece en lo que queda (con otro bloque por hacer), no en lo acabado');
  // Subir / bajar (la alternativa a arrastrar), entre lo que queda
  const b1 = OR.moverBloque(SES, h0, 'r', -1);
  check(ids(OR.aplicarOrden(SES, b1)) === 'p,r,a1,a2,c' && OR.moverBloque(SES, h0, 'p', -1) === null && OR.moverBloque(SES, h0, 'c', 1) === null && ids(OR.aplicarOrden(SES, OR.moverBloque(SES, h0, 'a1', 1))) === 'p,r,a1,a2,c',
    '«Subir» y «Bajar» mueven el bloque un puesto (la superserie, entera); arriba del todo no sube ni abajo del todo baja');
  check(ids(OR.aplicarOrden(SES, OR.moverBloque(SES, hP, 'r', -1))) === 'p,r,a1,a2,c', 'con lo hecho, «Subir» salta por encima de lo que queda, no de lo acabado');
  const orden = OR.reordenarPendientes(SES, h0, ['c', 'r', 'a1', 'p']);
  check(ids(OR.aplicarOrden(SES, orden)) === 'c,r,a1,a2,p' && OR.reordenarPendientes(SES, h0, ['c', 'r']) === null && OR.reordenarPendientes(SES, h0, ['p', 'a1', 'r', 'c']) === null,
    'arrastrar: los bloques que quedan en el orden nuevo; una lista que no son los que quedan, o el mismo orden, no cambia nada');
  // Dos superseries con la misma letra que se quedan seguidas no se juntan; una letra sola sigue sin ser superserie
  const RARO = [{ id: 'x1', series: 2, superserie: 'B' }, { id: 'x2', series: 2, superserie: 'B' }, { id: 'y', series: 2 }, { id: 'z1', series: 2, superserie: 'B' }, { id: 'z2', series: 2, superserie: 'B' }, { id: 's', series: 1, superserie: 'C' }];
  const lr = OR.aplicarOrden(RARO, ['x1', 'x2', 'z1', 'z2', 'y', 's']);
  check(gruposSuperserie(lr).length === 4 && gruposSuperserie(lr).map((g) => g.items.length).join() === '2,2,1,1' && gruposSuperserie(RARO).length === 4,
    'dos superseries B que se quedan seguidas al reordenar siguen siendo dos (y una letra sola, un ejercicio suelto)');
  check(OR.aplicarOrden(SES, null) === SES && OR.aplicarOrden(SES, ['p', 'a1', 'a2', 'r', 'c']) === SES && OR.aplicarOrden(SES, ['p', 'p']) === SES && OR.aplicarOrden(SES, 'p') === SES
    && ids(OR.aplicarOrden([...SES, { id: 'nuevo', series: 1 }], o1)) === 'a1,a2,r,c,p,nuevo',
    'sin orden, con el mismo o con uno raro, la lista tal cual; un ejercicio que el coach añade después va detrás');
  // Lo que sigue al orden nuevo: la serie que toca, «Ahora toca», los tramos y lo que viene tras una serie
  check(igual(AT.serieQueToca(l1, h0), { id: 'a1', numero: 1 }) && AT.ahoraToca({ ejercicios: l1, hechas: h0 }).id === 'a1' && tramosSesion(l1, h0)[0].ids.join() === 'a1,a2'
    && trasSerie(l1, { a1: 1, a2: 1, r: 3 }, 'r').siguiente.id === 'c' && trasSerie(l1, { a1: 3, a2: 3, r: 3, c: 2 }, 'c').siguiente.id === 'p',
    'con el orden nuevo, la serie que toca (la de «Ahora toca», la píldora y la pantalla de bloqueo), los tramos y lo que viene tras cada serie lo siguen');
  check(OR.ordenValido(['a', 'b']) && !OR.ordenValido([]) && !OR.ordenValido(['a', 'a']) && !OR.ordenValido([1]) && !OR.ordenValido(['x'.repeat(65)]) && !OR.ordenValido(null),
    'lo que se guarda en el móvil, comprobado (ids sin repetir)');
  // ---------- el coach: el orden de verdad, por la hora de cada serie
  const t = (m) => ({ registrada_en: new Date(Date.UTC(2026, 10, 5, 18, m)).toISOString() });
  const enOrden = { p: [t(0), t(3), t(6)], a1: [t(9), t(12)], a2: [t(10), t(13)], r: [t(16)] };
  check(OR.ordenReal(SES, enOrden) === null && OR.ordenReal(SES, { p: [t(0)] }) === null && OR.ordenReal(SES, {}) === null, 'hecho en el orden pautado (o un solo ejercicio), nada que decir');
  const otro = { p: [t(30), t(33), t(36)], a1: [t(1), t(4)], a2: [t(2), t(5)], r: [t(10), t(13), t(16)], c: [t(20), t(22)] };
  const real = OR.ordenReal(SES, otro);
  check(real && real.map((b) => b.clave).join() === 'a1,r,c,p' && real[0].ids.join() === 'a1,a2' && real[0].letra === 'A', 'hecho en otro orden: la superserie, el remo, el curl y el press al final (la superserie, un bloque)');
  // Una serie suelta antes de dejarlo para luego no lo adelanta (la mediana de sus horas)
  const suelta = { p: [t(0), t(40), t(43)], a1: [t(5), t(8)], a2: [t(6), t(9)], r: [t(15), t(18)], c: [t(25)] };
  check(OR.ordenReal(SES, suelta)?.map((b) => b.clave).join() === 'a1,r,c,p', 'una serie del press antes de que la máquina se ocupara no lo cuenta como el primero: va donde se hizo la mayor parte');
  check(OR.ordenReal(SES, { p: [t(0)], a1: [{ registrada_en: 'mal' }], r: [t(2)] }) === null, 'sin hora válida, no cuenta');

  // La serie que dijo la última marcada, tras reordenar: se queda a mitad de una ronda de superserie, se olvida si se deja para luego
  const SSr = [{ id: 'a1', series: 2, superserie: 'A' }, { id: 'a2', series: 2, superserie: 'A' }, { id: 'z', series: 2 }];
  const hR = { a1: { 1: {} } };
  check(igual(OR.proximaTrasReordenar(SSr, hR, { id: 'a2', numero: 1 }), { id: 'a2', numero: 1 }) && OR.proximaTrasReordenar(OR.aplicarOrden(SSr, OR.moverAlFinal(SSr, hR, 'a1')), hR, { id: 'a2', numero: 1 }) === null
    && OR.proximaTrasReordenar(SSr, hR, null) === null,
    'tras reordenar, la serie que tocaba se queda si su bloque sigue el primero (a mitad de una ronda); si se ha dejado para luego, manda el orden nuevo');
  // ---------- la política
  const legal7 = await import('../web/src/legal.js');
  const PV6 = await import('../web/src/logica/privacidad.js');
  const mov7 = legal7.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  check(PV6.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.6') && PV6.novedadesDesde('2026-12.5', '2026-12.6').length === 1 && PV6.formatoVersion('2026-12.6')
    && /orden de los ejercicios de una sesión/.test(mov7) && /la pauta de tu coach no cambia/.test(mov7) && /hora de cada serie/.test(mov7) && /solo en tu móvil/.test(PV6.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.6')[2]),
    'la política 2026-12.6: el orden de hoy se queda en el móvil (la pauta no cambia); el coach ve el orden por la hora de cada serie');
}


console.log('\nv0.65: abrir sin cobertura y «Novedades» tras actualizar');
{
  const SR = await import('../web/src/logica/sin-red.js');
  const { crearCopia } = await import('../web/src/datos/copia.js');
  const DIA = 86400000, T0 = Date.UTC(2026, 10, 5, 9);
  // ---------- la copia de la semana: qué vale y qué se poda
  const e = (uid, clave, t, datos = 1) => ({ uid, clave, t, datos });
  check(SR.copiaVale(e('u1', 'perfil', T0), 'u1', T0 + DIA) && !SR.copiaVale(e('u1', 'perfil', T0), 'u2', T0) && !SR.copiaVale(e('u1', 'perfil', T0 - 15 * DIA), 'u1', T0)
    && !SR.copiaVale(e('u1', 'perfil', T0 + DIA), 'u1', T0) && !SR.copiaVale({ uid: 'u1', t: T0 }, 'u1', T0) && !SR.copiaVale(null, 'u1', T0) && SR.copiaVale(e('u1', 'x', T0, null), 'u1', T0),
    'una entrada de la copia vale solo para su cuenta, con su hora (no del futuro) y durante dos semanas');
  const ents = [['u1|perfil', e('u1', 'perfil', T0)], ['u1|vieja', e('u1', 'programa:a', T0 - 20 * DIA)], ['raro', { x: 1 }]];
  for (let i = 0; i < 10; i++) ents.push([`u1|sesion:s${i}`, e('u1', `sesion:s${i}`, T0 - i * 1000)], [`u1|marcas:s${i}`, e('u1', `marcas:s${i}`, T0 - i * 1000)]);
  ents.push(['u2|sesion:z', e('u2', 'sesion:z', T0 - 99999)]);
  const fuera = SR.clavesAPodar(ents, T0);
  check(fuera.includes('u1|vieja') && fuera.includes('raro') && !fuera.includes('u1|perfil') && fuera.includes('u1|sesion:s8') && fuera.includes('u1|marcas:s9') && !fuera.includes('u1|sesion:s7') && !fuera.includes('u1|marcas:s0') && !fuera.includes('u2|sesion:z')
    && fuera.length === 6, `se podan lo caducado o mal formado y, por cuenta, las sesiones (y sus marcas) más allá de las ${SR.MAX_SESIONES_COPIA} últimas`);
  // Con un almacén en memoria: guarda por cuenta, lee solo lo de esa cuenta y nada con la sesión cerrada
  const mem = new Map();
  const alm = { leer: async (k) => mem.get(k), guardar: async (k, v) => { mem.set(k, v); }, borrar: async (k) => { mem.delete(k); }, todo: async () => [...mem] };
  let ahora = T0, cerrada = false;
  const cp = crearCopia({ almacen: alm, ahora: () => ahora, estaCerrada: () => cerrada });
  await cp.guardar('u1', 'programa:a', { bloque: 1 });
  check((await cp.leer('u1', 'programa:a'))?.datos.bloque === 1 && await cp.leer('u2', 'programa:a') === null && await cp.leer('u1', 'programa:b') === null, 'la copia: se lee lo guardado de esa cuenta (de otra, nada)');
  ahora = T0 + 15 * DIA;
  check(await cp.leer('u1', 'programa:a') === null && await cp.podar() === 1 && mem.size === 0, 'a las dos semanas sin ponerse al día no vale y se poda');
  cerrada = true;
  check(await cp.guardar('u1', 'perfil', {}) === false && mem.size === 0 && await cp.leer('u1', 'perfil') === null, 'con la sesión cerrada, ni se guarda ni se lee');
  check(await crearCopia({ almacen: null }).leer('u1', 'perfil') === null && await crearCopia({ almacen: null }).guardar('u1', 'perfil', 1) === false, 'sin IndexedDB, no hay copia (la app espera a la base, como antes)');
  // ---------- lo que espera en la cola, encima de lo que trae la copia (o la base)
  const det = { sesion: { id: 'S', completada: false }, ejercicios: [
    { id: 'p', series: 3, hechas: [{ id: 'db1', numero: 1, kg: 60, reps: 8 }] },
    { id: 'r', series: 3, hechas: [{ id: 'db2', numero: 1, kg: 40, reps: 10 }, { id: 'db3', numero: 2, kg: 40, reps: 10 }] }] };
  const ops = [
    { tipo: 'serie', datos: { sesion_ejercicio_id: 'p', numero: 2, kg: 62.5, reps: 8, registrada_en: 'x' }, atletaId: 'A' },
    { tipo: 'serie', datos: { sesion_ejercicio_id: 'p', numero: 1, kg: 61, reps: 8 }, atletaId: 'A' },
    { tipo: 'borrarSerie', datos: { sesion_ejercicio_id: 'r', numero: 2 }, atletaId: 'A' },
    { tipo: 'serie', datos: { sesion_ejercicio_id: 'otra', numero: 1, kg: 1, reps: 1 }, atletaId: 'A' },
    { tipo: 'sesion', datos: { id: 'S', cambios: { completada: true, fecha_realizada: '2026-11-05' } }, atletaId: 'A' }];
  const d2 = SR.sesionConCola(det, ops);
  check(igual(d2.ejercicios[0].hechas.map((x) => [x.id, x.numero, x.kg]), [['db1', 1, 61], ['local-p-2', 2, 62.5]]) && igual(d2.ejercicios[1].hechas.map((x) => x.numero), [1])
    && d2.sesion.completada === true && det.ejercicios[0].hechas.length === 1 && det.sesion.completada === false,
    'lo apuntado sin conexión sale encima de la copia: una serie nueva se añade, una corregida conserva su id, un borrado la quita y la sesión terminada sale terminada (sin tocar lo original)');
  check(SR.sesionConCola(det, []) === det && SR.sesionConCola(det, [ops[3]]) === det && SR.sesionConCola(null, ops) === null, 'sin nada de esa sesión en la cola, la misma');
  check(igual(SR.enColaDe(det, ops), { 'p-2': true, 'p-1': true }) && igual(SR.enColaDe(det, [ops[0], { tipo: 'borrarSerie', datos: { sesion_ejercicio_id: 'p', numero: 2 } }]), {}),
    'y esas series llevan su marca de «guardada en el móvil» (las borradas, no)');
  const prog = { actual: { id: 'w1' }, bloque: { atleta_id: 'A' }, sesiones: { w1: [{ id: 'S', completada: false }, { id: 'T', completada: false }, { id: 'U', completada: true }, { id: 'V', completada: false }, { id: 'X', completada: false }] } };
  const p2 = SR.programaConCola(prog, ops);
  check(p2.sesiones.w1[0].completada === true && p2.sesiones.w1[1].completada === false && prog.sesiones.w1[0].completada === false && SR.programaConCola(prog, []) === prog,
    'en el programa (Hoy y Semana), la sesión terminada sin conexión sale terminada');
  check(igual(SR.sesionesAPreparar(prog), ['S', 'T', 'V']) && igual(SR.sesionesAPreparar(prog, 2), ['S', 'T']) && igual(SR.sesionesAPreparar({ actual: null }), []),
    'tras una visita con conexión se dejan en el móvil las sesiones que quedan de la semana (hoy y lo que viene), como mucho 3');
  // La cola dice lo que espera (copias: tocarlas no cambia la cola)
  const colaV = crearCola({ guardarSerie: async () => { const x = new Error('Sin conexión.'); x.sinConexion = true; throw x; } }, { clave: 'prueba-065' });
  colaV.fijarAtleta('A');
  await colaV.enviar({ tipo: 'serie', datos: { sesion_ejercicio_id: 'p', numero: 1, kg: 50, reps: 5 }, atletaId: 'A' });
  const opsV = colaV.operaciones();
  opsV[0].datos.kg = 999;
  check(opsV.length === 1 && colaV.operaciones()[0].datos.kg === 50 && colaV.pendientes() === 1, 'la cola enseña lo que espera de ese atleta, en orden (copias)');
  colaV.fijarAtleta(null);
  // ---------- el código: la copia solo de lo tuyo, la sesión provisional sin red, el service worker sin esperar
  const apiSrc = readFileSync(new URL('../web/src/datos/api.js', import.meta.url), 'utf8');
  const supaSrc = readFileSync(new URL('../web/src/datos/backend-supabase.js', import.meta.url), 'utf8');
  const swSrc = readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
  check(/propia\(atletaId\) \? conCopia/.test(apiSrc) && /ESPERA_RED_MS = 1200/.test(apiSrc) && /esTemporal\(r\.e\)\) throw r\.e/.test(apiSrc) && /if \(v === null\) throw sinConexion\(\)/.test(apiSrc),
    'la copia solo guarda lo de tu propia ficha (nunca lo de otros atletas que ve el coach), espera a la base como mucho 1,2 s y un error de verdad no se tapa con la copia');
  check(/AuthRetryableFetchError/.test(supaSrc) && (supaSrc.match(/await conSesion\(\);/g) || []).length >= 8 && /INITIAL_SESSION/.test(supaSrc),
    'sin red y con el permiso caducado, la sesión guardada sigue (provisional) y nada sale a la base sin renovarla (no lee listas vacías ni rechaza series)');
  const { sesionGuardada } = await import('../web/src/datos/backend-supabase.js');
  const almS = (v) => ({ getItem: () => v });
  check(sesionGuardada('k', almS(JSON.stringify({ refresh_token: 'r', access_token: 'a', user: { id: '0f6b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d', email: 'ana@x' } })))?.user.id === '0f6b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d'
    && sesionGuardada('k', almS(JSON.stringify({ access_token: 'a', user: { id: '0f6b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d' } }))) === null && sesionGuardada('k', almS('basura')) === null && sesionGuardada('k', almS(null)) === null,
    'la sesión guardada solo vale con su cuenta y con qué renovarse');
  check(/ESPERA_RED_MS = 1500/.test(swSrc) && /Promise\.race\(\[red\.catch\(\(\) => guardada\)/.test(swSrc), 'el service worker no espera a la red más de 1,5 s para abrir la app si ya tiene la página guardada');
  // ---------- «Novedades»
  const NA = await import('../web/src/logica/novedades-app.js');
  const { NOVEDADES } = await import('../web/src/novedades.js');
  check(NA.versionCorta('0.65.0') === '0.65' && NA.versionCorta('0.63.1') === '0.63' && NA.versionCorta('1.2') === '1.2' && NA.versionCorta('x') === null && NA.versionCorta(null) === null
    && NA.compararApp('0.9.0', '0.10.0') === -1 && NA.compararApp('0.65.1', '0.65.0') === 0 && NA.compararApp('1.0', '0.99') === 1 && NA.compararApp('x', '0.1') === null,
    'las versiones de la app se comparan por mayor y menor, como números (0.9 < 0.10); los arreglos no cuentan');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const nov65 = NA.novedadesQueVer(NOVEDADES, { vista: '0.64.0', actual: '0.65.0' });
  check(NOVEDADES[NA.versionCorta(pkg.version)] != null && nov65.length === 2 && nov65.length <= 3 && /sin cobertura/i.test(nov65[0]) && NA.novedadesQueVer(NOVEDADES, { vista: '0.64.0', actual: '0.65.0', rol: 'coach' }).length === 1,
    'de la 0.64 a la 0.65: las frases de la 0.65 para el atleta (como mucho tres) y la del coach (y la versión de package.json tiene las suyas)');
  const salto = NA.novedadesQueVer(NOVEDADES, { vista: '0.62.0', actual: '0.65.0' });
  check(salto.length === 5 && /sin cobertura/i.test(salto[0]) && /Máquina ocupada/.test(salto[2]) && /Teclado propio/.test(salto[3]) && !salto.some((t) => /Ahora toca/.test(t)),
    'si se han saltado versiones, las de todas juntas, de la más nueva a la más antigua, como mucho 5');
  check(NA.novedadesQueVer(NOVEDADES, { vista: null, actual: '0.65.0' }).length === 0 && NA.novedadesQueVer(NOVEDADES, { vista: '0.65.0', actual: '0.65.0' }).length === 0
    && NA.novedadesQueVer(NOVEDADES, { vista: '0.65.0', actual: '0.65.3' }).length === 0 && NA.novedadesQueVer(NOVEDADES, { vista: '0.66.0', actual: '0.65.0' }).length === 0
    && NA.novedadesQueVer(NOVEDADES, { vista: '0.64.0', actual: '0.65.0', rol: 'nadie' }).length === 0 && NA.novedadesQueVer(NOVEDADES, { vista: '0.62.0', actual: '0.63.0', rol: 'coach' }).length === 0,
    'nada la primera vez, con la misma versión (o un arreglo), hacia atrás, ni al coach si no hay nada para él');
  check(Object.entries(NOVEDADES).every(([v, x]) => NA.versionCorta(v) === v && (x.atleta || []).length <= 3 && [...(x.atleta || []), ...(x.coach || [])].every((t) => typeof t === 'string' && t.length <= 140)),
    'el archivo de novedades: por versión, hasta tres frases cortas para el atleta');
  check(NA.versionVistaInicial({ guardada: '0.64.0', politicaVista: '2026-12.4', actual: '0.65.0' }) === '0.64.0' && NA.versionVistaInicial({ politicaVista: '2026-12.5', actual: '0.65.0' }) === '0.63'
    && NA.versionVistaInicial({ politicaVista: '2026-12', actual: '0.65.0' }) === '0.64' && NA.versionVistaInicial({ politicaVista: null, actual: '0.65.0' }) === '0.65.0' && NA.claveVersionVista('u') === 'fbe-version-vista-u'
    && NA.versionVistaInicial({ politicaVista: '2026-12.7', actual: '0.66.0' }) === '0.66.0' && NA.versionVistaInicial({ politicaVista: '2026-12.9', actual: '0.66.0' }) === '0.66.0' && NA.versionVistaInicial({ politicaVista: '2026-12.2', actual: '0.66.0' }) === '0.64',
    'desde qué versión se mira: la guardada; quien ya usaba la app, por la política que vio; la primera vez en el móvil o una cuenta nueva, la actual (no sale nada)');
  // ---------- la política 2026-12.7
  const legal8 = await import('../web/src/legal.js');
  const PV7 = await import('../web/src/logica/privacidad.js');
  const mov8 = legal8.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  check(PV7.NOVEDADES_PRIVACIDAD.some((x) => x[3] === '2026-12.7') && PV7.novedadesDesde('2026-12.6', '2026-12.7').length === 1 && PV7.formatoVersion('2026-12.7')
    && /copia de tu semana/.test(mov8) && /sin cobertura/.test(mov8) && /al cerrar la sesión/.test(mov8) && /última versión de la app/.test(mov8) && /sin cobertura|sin señal|no tengas señal/.test(PV7.NOVEDADES_PRIVACIDAD.find((x) => x[3] === '2026-12.7')[2]),
    'la política 2026-12.7: la copia de tu semana en el móvil (para abrir sin cobertura) y la última versión vista');
  const appSrc = readFileSync(new URL('../web/src/ui/App.jsx', import.meta.url), 'utf8');
  check(/Sin conexión · se guardará al volver/.test(appSrc), 'sin conexión, una línea tranquila: «Sin conexión · se guardará al volver»');
}

console.log('\nv0.67: «Revisión semanal» del coach');
{
  const RV = await import('../web/src/logica/revision.js');
  const base = { sesiones: { completadas: 3, total: 3 }, checkin: true, molestia: 0, videos: 0, mensajes: 0, hecha: false, servicio: 'completo' };
  const f = (nombre, x = {}) => ({ ...base, nombre, atleta_id: nombre, ...x });
  const av = RV.avisosRevision(f('A', { molestia: 3, mensajes: 2, videos: 1, checkin: false }));
  check(av.map((x) => x.tipo).join(',') === 'molestia,mensajes,videos,checkin' && av[0].nivel === 'alerta' && av[0].texto === 'Molestia 3/5' && av[1].texto === '2 mensajes sin leer' && av[2].texto === '1 vídeo sin revisar' && av[3].texto === 'Sin check-in',
    'lo que pide atención: molestia (fuerte, en rojo), mensajes sin leer, vídeos sin revisar y el check-in que falta');
  check(RV.avisosRevision(f('B')).map((x) => x.texto).join() === 'Check-in enviado' && RV.avisosRevision(f('C', { molestia: 1 })).length === 1
    && RV.avisosRevision(f('N', { servicio: 'nutricion', checkin: false })).length === 0 && RV.pendientesDe(f('B')) === 0,
    'el check-in enviado sale en verde (no cuenta como pendiente); una molestia de 1/5 no sale; a quien solo lleva nutrición no se le pide check-in de entreno');
  const orden = RV.ordenRevision([
    f('Zoe', { hecha: true, molestia: 3 }),
    f('Bea', { sesiones: { completadas: 1, total: 3 } }),
    f('Ana'),
    f('Leo', { mensajes: 1 }),
    f('Iván', { molestia: 3 }),
    f('Cris', { sesiones: { completadas: 0, total: 3 } }),
  ]).map((x) => x.nombre);
  check(orden.join(' ') === 'Iván Leo Cris Bea Ana Zoe', `el orden: lo urgente, lo que más pide atención, quien ha hecho menos de lo pautado y, al final, los revisados (${orden.join(', ')})`);
  check(RV.ordenRevision([]).length === 0 && RV.ordenRevision(null).length === 0, 'sin atletas, lista vacía');
}

console.log('\nv0.68: la bienvenida del día');
{
  const BV = await import('../web/src/logica/bienvenida.js');
  const hoyB = '2026-11-05';
  check(BV.tocaBienvenida({ vista: null, hoy: hoyB }) && BV.tocaBienvenida({ vista: '2026-11-04', hoy: hoyB }) && !BV.tocaBienvenida({ vista: hoyB, hoy: hoyB })
    && !BV.tocaBienvenida({ vista: null, hoy: hoyB, sesionEnCurso: true }) && !BV.tocaBienvenida({ vista: null, hoy: null }),
    'sale una vez al día (la primera vez que se abre ese día), nunca con una sesión a medias');
  check(BV.nombreDePila('  Ana   López ') === 'Ana' && BV.nombreDePila('') === '' && BV.nombreDePila(null) === '', 'el nombre de pila');
  const m = (x) => BV.mensajeBienvenida({ nombre: 'Ana López', hoy: hoyB, ...x });
  const c = BV.mensajeBienvenida({ rol: 'coach', nombre: 'Pelayo' });
  check(`${c.saludo} ${c.nombre}` === 'Valar morghulis, coach supremo', 'al coach: «Valar morghulis, coach supremo»');
  check(m({ primeraVez: true, toca: 'Torso A' }).mensaje === 'Tu primera sesión te espera: Torso A.' && m({ primeraVez: true }).saludo === 'Hola,', 'si aún no ha entrenado: su primera sesión le espera');
  check(m({ ultimoDia: '2026-10-27', toca: 'Pierna A' }).mensaje === 'Llevas 9 días sin entrenar. ¿Retomamos hoy?' && m({ ultimoDia: '2026-10-27', toca: 'Pierna A' }).detalle === 'Te espera Pierna A.',
    '9 días sin entrenar: «¿Retomamos hoy?»');
  check(/^Hace 5 días de tu último entreno/.test(m({ ultimoDia: '2026-10-31' }).mensaje) && m({ haceMucho: true }).mensaje === 'Hace tiempo de tu último entreno. ¿Retomamos hoy?',
    'de 4 a 6 días, un empujón suave; más de 11 semanas, «hace tiempo»');
  const r = m({ ultimoDia: '2026-11-04', record: { ejercicio: 'Sentadilla', fecha: '2026-11-04' }, toca: 'Torso B' });
  check(r.mensaje === 'Vienes de un récord en Sentadilla. ¡A por más!' && r.detalle === 'Hoy toca Torso B.' && !/récord/.test(m({ ultimoDia: '2026-11-04', record: { ejercicio: 'Sentadilla', fecha: '2026-11-01' } }).mensaje),
    'tras un récord (de los dos últimos días), el récord; uno más antiguo, no');
  const t = m({ ultimoDia: '2026-11-03', estado: 'entreno', toca: 'Pierna A', racha: 3 });
  check(t.saludo === 'Hola de nuevo,' && t.nombre === 'Ana' && t.mensaje === 'Hoy toca Pierna A.' && t.detalle === 'Llevas 3 semanas completas seguidas.', 'si hoy toca: cuál, con su racha');
  check(m({ ultimoDia: hoyB, estado: 'hecha' }).mensaje === 'La sesión de hoy ya está hecha. ¡Buen trabajo!' && m({ ultimoDia: '2026-11-03', estado: 'descanso' }).mensaje === 'Hoy toca descanso: recupera bien.'
    && m({ ultimoDia: '2026-11-03', estado: 'semana' }).mensaje === 'Semana completa. ¡Enhorabuena!' && m({ ultimoDia: '2026-11-03' }).mensaje === '¿Qué toca hoy?',
    'hecha, descanso, semana completa y lo de siempre');
}

console.log('\nv0.69: la comunidad, primera tanda (bienvenida, entrenando ahora, respuestas, 💪 a comentarios, el resumen del domingo)');
{
  const C = await import('../web/src/logica/comunidad.js');
  const r = C.textoResumenDomingo({ sesiones: 42, records: 3, semana_completa: 5 });
  check(r.titulo === 'Esta semana en el equipo: 42 sesiones, 3 récords' && r.cuerpo === '5 con la semana completa. Míralo en Equipo.' && r.titulo.length <= 80 && r.cuerpo.length <= 160,
    'el resumen del domingo: «Esta semana en el equipo: 42 sesiones, 3 récords» (cabe en una notificación)');
  check(C.textoResumenDomingo({ sesiones: 1, records: 1 }).titulo === 'Esta semana en el equipo: 1 sesión, 1 récord' && C.textoResumenDomingo({ sesiones: 7 }).titulo === 'Esta semana en el equipo: 7 sesiones'
    && C.textoResumenDomingo({ sesiones: 7 }).cuerpo === 'Míralo en Equipo.' && C.textoResumenDomingo({ sesiones: 0, records: 2 }) === null && C.textoResumenDomingo() === null,
    'en singular, sin récords y sin semanas completas; sin sesiones, no hay resumen');
  const ahora = Date.parse('2026-11-05T12:00:00Z');
  const n = C.nuevosParaBienvenida([
    { perfil_id: 'a', desde: '2026-11-01T10:00:00Z' }, { perfil_id: 'yo', desde: '2026-11-04T10:00:00Z' },
    { perfil_id: 'b', desde: '2026-11-04T10:00:00Z' }, { perfil_id: 'c', desde: '2026-10-28T10:00:00Z' }, null,
  ], 'yo', ahora);
  check(n.map((x) => x.perfil_id).join() === 'b,a' && C.DIAS_BIENVENIDA === 7, 'la bienvenida: los de su primera semana (7 días), los más nuevos primero, nunca uno mismo');
  const L = [
    { id: '1', responde_a: null }, { id: '2', responde_a: null }, { id: '3', responde_a: '1' }, { id: '4', responde_a: '3' },
    { id: '5', responde_a: 'oculto' }, { id: '6', responde_a: '2' },
  ];
  const h = C.hilosComentarios(L);
  check(h.map((x) => x.id).join() === '1,2,5' && h[0].respuestas.map((x) => x.id).join() === '3,4' && h[1].respuestas.map((x) => x.id).join() === '6' && h[2].respuestas.length === 0
    && h.every((x) => x.respuestas.every((y) => !y.respuestas.length)),
    'los comentarios con sus respuestas debajo (un nivel); la respuesta a un comentario que ya no se ve, suelta');
  check(C.hilosComentarios([]).length === 0, 'sin comentarios, nada');
  // La política 2026-12.8 y las novedades de la 0.69
  const legal = await import('../web/src/legal.js');
  const PV = await import('../web/src/logica/privacidad.js');
  const { NOVEDADES } = await import('../web/src/novedades.js');
  const com = legal.PRIVACIDAD.find((x) => x[0] === 'La comunidad del equipo')[1];
  const mov = legal.PRIVACIDAD.find((x) => x[0] === 'Lo que se queda en tu móvil')[1];
  check(legal.VERSION_LEGAL === '2026-12.8' && PV.NOVEDADES_PRIVACIDAD[0][3] === '2026-12.8' && PV.novedadesDesde('2026-12.7', '2026-12.8').length === 1
    && /Entrenando ahora/.test(com) && /apagado de entrada/.test(com) && /nunca la hora/.test(com) && /bienvenida/.test(com) && /responder a un comentario/.test(com) && /domingo/.test(com)
    && /Compartir mis entrenos sin preguntar/.test(mov) && /solo en ese móvil/.test(mov) && /Deshacer/.test(mov),
    'la política 2026-12.8: «Entrenando ahora» (apagado de entrada, sin horas), la bienvenida, las respuestas, el resumen del domingo y compartir sin preguntar (en el móvil)');
  const v = NOVEDADES['0.69'];
  check(v.atleta.length <= 3 && v.atleta.every((t) => t.length <= 140) && v.coach.every((t) => t.length <= 140), 'las novedades de la 0.69: hasta tres frases cortas para los atletas (y una para el coach)');
}

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
