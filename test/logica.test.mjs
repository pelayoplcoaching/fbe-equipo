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
  check(/el tamaño de la letra/.test(fila ? fila[1] : textoLegal) && legal.VERSION_LEGAL === '2026-10', '«Lo que se queda en tu móvil» dice también el tamaño de la letra (sin cambiar la versión de la política)');
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
  check(/foto que eliges para una tarjeta/.test(fila[1]) && legal.VERSION_LEGAL === '2026-10', '«Lo que se queda en tu móvil» dice que la foto de la tarjeta no se sube (sin cambiar la versión de la política)');
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
  check(/Respira/.test(filaL[1]) && /hitos de la racha/.test(filaL[1]) && legal.VERSION_LEGAL === '2026-10', '«Lo que se queda en tu móvil» dice «Respira» y los hitos ya celebrados (sin cambiar la versión de la política)');
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
  check(/Los descansos que eliges tú .* se guardan en tu móvil/.test(filaL[1]) && legal.VERSION_LEGAL === '2026-10', '«Lo que se queda en tu móvil» dice que los descansos que eliges se guardan en tu móvil (sin cambiar la versión de la política)');
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
  check(igual(rs, [{ emoji: '❤️', n: 1, mia: false }, { emoji: '💪', n: 2, mia: true }]), 'las reacciones, agrupadas en el orden de la lista (las que no son de la lista, fuera)');
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
  check(igual(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', leido_en: '2026-11-03T18:50:00', editado_en: '2026-11-03T18:45:00' }, ahora), [['Enviado', 'hoy 18:42'], ['Leído', 'hoy 18:50'], ['Editado', 'hoy 18:45']])
    && M.infoMensaje({ creado_en: '2026-11-03T18:42:00' }, ahora)[1][1] === 'todavía no', 'Info de un mensaje: enviado, leído (o todavía no) y editado');
  {
    // (v0.54, revisión) L3: con «Mostrar cuándo estoy en línea» apagado, el leído sin hora; y el que guardó la base solo con el día
    const { instanteMadrid } = await import('../web/src/logica/fechas.js');
    const soloDia = instanteMadrid('2026-11-03', '00:00');
    check(M.leidoSoloDia(soloDia) && !M.leidoSoloDia('2026-11-03T18:50:00') && !M.leidoSoloDia(null), 'un leído de medianoche de Madrid es «solo el día»');
    check(igual(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', leido_en: '2026-11-03T18:50:00' }, ahora, { horaLeido: false })[1], ['Leído', 'hoy'])
      && igual(M.infoMensaje({ creado_en: '2026-11-03T18:42:00', leido_en: soloDia }, ahora)[1], ['Leído', 'hoy'])
      && igual(M.infoMensaje({ creado_en: '2026-11-02T18:42:00', leido_en: instanteMadrid('2026-11-02', '00:00') }, ahora)[1], ['Leído', 'ayer']),
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

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
