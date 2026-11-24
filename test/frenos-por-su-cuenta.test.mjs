// «FBE por tu cuenta»: los cuatro frenos que aprobó Pelayo el 24/11/2026 para los atletas sin seguimiento, y que con
// seguimiento no cambia nada. Lógica pura, con datos inventados.
//   node test/frenos-por-su-cuenta.test.mjs
import { resolverReglas, leerEjercicio, porSerie, doble, soloReps, desdeLoHecho, unSaltoComoMucho, proponerSemana, FRENO_POR_SU_CUENTA } from '../web/src/logica/motor/index.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const RN = resolverReglas({});
const P = (extra = {}) => ({ id: 'p1', sesion_id: 's1', ejercicio_id: 'banca', orden: 1, prioridad: 'alta', series: 3, reps_min: 8, reps_max: 12,
  rir_objetivo: null, rpe_objetivo: 8, carga_sugerida_kg: 80, backoff_pct: null, series_detalle: null, ...extra });
const S = (numero, kg, reps, rpe = null, extra = {}) => ({ numero, kg, reps, rpe, rir: null, ...extra });
const banca = { nombre: 'Press banca', tipo: ['basico'], grupos_musculares: ['pectoral'] }, hip = { nombre: 'Hip thrust', tipo: ['basico'], grupos_musculares: ['gluteo'] };
const jalon = { nombre: 'Jalón al pecho', tipo: ['multiarticular'], grupos_musculares: ['espalda'] }, rueda = { nombre: 'Rueda abdominal', tipo: ['aislamiento'], grupos_musculares: ['abdominales'] };
const lee = (ej, pauta, series) => leerEjercicio({ pauta, series, nombre: ej.nombre, reglas: RN });
// El modelo de partida, con seguimiento (psc = false) o por su cuenta (psc = true)
const run = (ej, pauta, series, { psc = false, previa = null, nivel = 'intermedio' } = {}) => porSerie(lee(ej, pauta, series), pauta,
  { nombre: ej.nombre, reglas: RN, ejercicio: ej, nivel, ...(previa ? { previa } : {}), ...(psc ? { porSuCuenta: true } : {}) });
const f = (r) => (r.propuesta.series_detalle ? r.propuesta.series_detalle.map((x) => `${x.reps}×${x.kg ?? '-'}`).join(' ') : `igual (${r.propuesta.carga_sugerida_kg ?? '-'} kg)`);
const frenosDe = (r) => (r.frenos || []).map((x) => x.id);
const detalle = (n, reps, kg, rpe = 8) => Array.from({ length: n }, () => ({ reps, kg, rpe }));

console.log('Freno 1: si movió menos kilos de los pautados, se parte de lo que hizo');
{
  const pauta = P({ series: 3, carga_sugerida_kg: null, series_detalle: detalle(3, 8, 100) });
  const hecho = [S(1, 80, 8, 9.5), S(2, 80, 8, 9.5), S(3, 80, 8, 9.5)];
  const con = run(banca, pauta, hecho), sola = run(banca, pauta, hecho, { psc: true });
  check(con.tipo === 'mantener' && igual(con.propuesta.series_detalle, pauta.series_detalle), 'con seguimiento, igual que siempre: repite lo pautado');
  check(f(sola) === '8×80 8×80 8×80' && frenosDe(sola).includes('desde_lo_hecho'), 'por su cuenta: «igual» es lo que hizo (8 × 80), no lo pautado (8 × 100), y se dice');
  const escrita = P({ series: 3, reps_min: 12, reps_max: 12, carga_sugerida_kg: 80 });
  const sinRpe = [S(1, 70, 12), S(2, 70, 12), S(3, 70, 12)];
  check(run(banca, escrita, sinRpe).propuesta.carga_sugerida_kg === 80, 'sin RPE apuntado y con seguimiento, la pauta escrita se queda como estaba (80 kg)');
  check(f(run(banca, escrita, sinRpe, { psc: true })) === '12×70 12×70 12×70', 'por su cuenta, la misma semana sale con los kilos que movió (70 kg)');
  const l = lee(banca, pauta, [S(1, 90, 8, 8), S(2, 95, 8, 8), S(3, 100, 8, 8)]);
  check(igual(desdeLoHecho(l, pauta, {}), desdeLoHecho(l, pauta, { porSuCuenta: false })) && desdeLoHecho(l, pauta, {}).series_detalle[0].kg === 100, 'sin el modo, desdeLoHecho devuelve la pauta tal cual');
  check(desdeLoHecho(l, pauta, { porSuCuenta: true }).series_detalle.map((x) => x.kg).join(',') === '90,95,100', 'con el modo, cada serie baja a lo que movió en ella (las que cumplió, igual)');
  // La doble progresión con una semana a medias (1 de 3 series): tampoco vuelve a lo pautado si movió menos
  const tres = P({ series: 3, reps_min: 5, reps_max: 5, carga_sugerida_kg: 100 });
  const medias = lee(banca, tres, [S(1, 90, 5, 8)]);
  check(medias.diagnostico === 'a_medias' && doble(medias, tres, { nombre: 'Press banca', reglas: RN }).propuesta.carga_sugerida_kg === 100 && doble(medias, tres, { nombre: 'Press banca', reglas: RN, porSuCuenta: true }).propuesta.carga_sugerida_kg === 90,
    'otros modelos: con la semana a medias, por su cuenta parte de los 90 kg que movió');
  const solo = P({ series: 2, reps_min: 10, reps_max: 10, carga_sugerida_kg: 20 });
  check(soloReps(lee(rueda, solo, [S(1, 15, 9, 9), S(2, 15, 9, 9)]), solo, { nombre: rueda.nombre, reglas: RN, porSuCuenta: true }).propuesta.carga_sugerida_kg === 15, 'solo repeticiones: la carga es la que movió (15 kg), no la pautada');
}

console.log('Freno 2: si lo apuntado parece una errata, se pregunta antes de proponer');
{
  const ejercicios = { jalon };
  const pautas = [P({ id: 'a', ejercicio_id: 'jalon', prioridad: 'media', series: 2, reps_min: 10, reps_max: 12, carga_sugerida_kg: 60 })];
  const sesiones = [{ id: 's1', orden: 1, completada: true }];
  const series = { a: [S(1, 60, 10, 8), S(2, 6, 10, 8)] };
  const con = proponerSemana({ pautas, sesiones, series, ejercicios, atleta: { nivel: 'intermedio' } });
  const sola = proponerSemana({ pautas, sesiones, series, ejercicios, atleta: { nivel: 'intermedio', modalidad: 'por_su_cuenta' } });
  check(con.filas[0].tipo !== 'pregunta' && con.filas[0].frenos.some((x) => x.id === 'dato_raro') && !con.filas[0].pregunta && con.semana.preguntas === undefined, 'con seguimiento, como siempre: la descarta, propone y te avisa');
  const fs = sola.filas[0];
  check(fs.tipo === 'pregunta' && !fs.cambia && fs.pregunta?.tipo === 'errata' && fs.pregunta.series[0].numero === 2 && fs.pregunta.series[0].kg === 6 && /serie 2/.test(fs.pregunta.texto),
    'por su cuenta: no propone; deja la pregunta para el atleta (serie 2, 6 kg)');
  check(sola.semana.porSuCuenta === true && sola.semana.preguntas === 1 && fs.frenos.some((x) => x.id === 'errata_pregunta') && fs.confianza === 'baja', 'la semana dice cuántas preguntas esperan respuesta');
  const confirmada = proponerSemana({ pautas, sesiones, series: { a: [S(1, 60, 10, 8), S(2, 6, 10, 8, { confirmada: true })] }, ejercicios, atleta: { nivel: 'intermedio', modalidad: 'por_su_cuenta' } });
  const fc = confirmada.filas[0];
  check(fc.tipo !== 'pregunta' && confirmada.semana.preguntas === 0 && fc.propuesta.series_detalle?.[1]?.kg <= 6 + 2.5, 'si el atleta lo confirma, se usa: la serie 2 parte de sus 6 kg');
  const corregida = proponerSemana({ pautas, sesiones, series: { a: [S(1, 60, 10, 8), S(2, 60, 10, 8)] }, ejercicios, atleta: { nivel: 'intermedio', modalidad: 'por_su_cuenta' } });
  check(corregida.filas[0].tipo !== 'pregunta', 'si lo corrige, ya no hay errata y se propone con normalidad');
}

console.log('Freno 3: nunca por debajo del mínimo del rango, tampoco en la serie pesada');
{
  const pauta = P({ ejercicio_id: 'hip', series: 3, reps_min: 8, reps_max: 12, carga_sugerida_kg: null });
  const hecho = [S(1, 120, 8, 8.5), S(2, 110, 10, 8), S(3, 110, 10, 8)];
  const con = run(hip, pauta, hecho, { nivel: 'novato' }), sola = run(hip, pauta, hecho, { nivel: 'novato', psc: true });
  check(con.propuesta.series_detalle[0].kg === 122.5 && con.propuesta.series_detalle[0].reps < 8, 'con seguimiento, la serie pesada del hip thrust sube y baja de 8 (como hasta ahora)');
  check(sola.propuesta.series_detalle[0].kg === 120 && sola.propuesta.series_detalle[0].reps === 9 && /no llegaría a 8/.test(sola.motivo) && frenosDe(sola).includes('minimo_rango'),
    'por su cuenta: con el salto no llegaría a 8, así que suma una repetición (9 × 120)');
  const tope = run(hip, pauta, [S(1, 120, 12, 8.5), S(2, 110, 10, 8), S(3, 110, 10, 8)], { nivel: 'novato', psc: true });
  check(tope.propuesta.series_detalle[0].kg === 122.5 && tope.propuesta.series_detalle[0].reps >= 8, 'en el tope sí sube, y como mucho vuelve al mínimo del rango');
  const b = P({ series: 1, reps_min: 8, reps_max: 8, carga_sugerida_kg: 60 });
  check(f(run(banca, b, [S(1, 60, 6, 10)])) === '5×60' && f(run(banca, b, [S(1, 60, 6, 10)], { psc: true })) === 'igual (60 kg)', 'a RPE 10 sin llegar a lo pautado: con seguimiento, una menos (5); por su cuenta, se queda en el mínimo (6)');
  check(f(run(banca, b, [S(1, 60, 7, 10)], { psc: true })) === '6×60', 'si quitar una repetición no baja del mínimo, se quita igual que con seguimiento');
  const normal = P({ series: 4, reps_min: 6, reps_max: 10, carga_sugerida_kg: 35 });
  const a = [S(1, 35, 10, 7), S(2, 35, 10, 8), S(3, 35, 10, 8), S(4, 35, 10, 8)];
  check(igual(run(banca, normal, a).propuesta, run(banca, normal, a, { psc: true }).propuesta), 'donde no bajaba del mínimo, la propuesta es la misma que con seguimiento');
}

console.log('Freno 4: dos semanas por debajo del rango sin avanzar, baja un salto');
{
  const pauta = P({ ejercicio_id: 'jalon', prioridad: 'media', series: 2, reps_min: 10, reps_max: 12, carga_sugerida_kg: 50 });
  const previa = lee(jalon, pauta, [S(1, 50, 6, 9.5), S(2, 50, 6, 9.5)]);
  const hecho = [S(1, 50, 6, 9.5), S(2, 50, 6, 9.5)];
  check(f(run(jalon, pauta, hecho, { previa })) === 'igual (50 kg)', 'con seguimiento, se queda igual');
  const sola = run(jalon, pauta, hecho, { previa, psc: true });
  check(f(sola) === '8×47.5 8×47.5' && sola.tipo === 'bajar' && /dos semanas por debajo del rango \(8–12\): baja 2,5 kg y vuelve a 8/i.test(sola.motivo) && frenosDe(sola).includes('baja_rango'),
    'por su cuenta: baja un salto (47,5 kg) y vuelve al mínimo del rango (8)');
  check(f(run(jalon, pauta, hecho, { psc: true })) === 'igual (50 kg)', 'la primera semana por debajo todavía no baja');
  check(f(run(jalon, pauta, [S(1, 50, 6, 8), S(2, 50, 6, 8)], { previa, psc: true })) === '7×50 7×50', 'si va sumando repeticiones (RPE 8), avanza: no se baja');
  const cinco = P({ series: 2, reps_min: 5, reps_max: 5, carga_sugerida_kg: 100 });
  const p5 = lee(banca, cinco, [S(1, 100, 5, 9.5), S(2, 100, 5, 9.5)]);
  check(f(run(banca, cinco, [S(1, 100, 5, 9.5), S(2, 100, 5, 9.5)], { previa: p5, psc: true })) === 'igual (100 kg)', 'si lo pautado ya iba por debajo del rango a propósito (5 repeticiones), ese es su mínimo: no baja');
  const peso = P({ ejercicio_id: 'rueda', prioridad: 'baja', series: 2, reps_min: 10, reps_max: 15, carga_sugerida_kg: null });
  const pp = lee(rueda, peso, [S(1, null, 4), S(2, null, 4)]);
  const sinKilos = run(rueda, peso, [S(1, null, 4), S(2, null, 4)], { previa: pp, psc: true });
  check(sinKilos.avisos.some((x) => /sin carga que bajar/.test(x)), 'sin kilos que bajar (peso corporal), avisa de que toca una variante más fácil');
}

console.log('Red de seguridad: nunca más de un salto sobre lo que hizo');
{
  const propuesta = { series: 3, reps_min: 8, reps_max: 8, rir_objetivo: null, rpe_objetivo: 8, carga_sugerida_kg: 102.5, backoff_pct: 10, series_detalle: null };
  const l = { hechas: [S(1, 100, 8, 8), S(2, 80, 8, 8), S(3, 80, 8, 8)] };
  const lim = unSaltoComoMucho(propuesta, l, { nombre: 'Press banca', reglas: RN, sube: true });
  check(lim && lim.series_detalle[0].kg === 102.5 && lim.series_detalle[1].kg === 82.5 && lim.series_detalle[2].kg === 82.5 && lim.backoff_pct === null, 'back-off por encima de lo que movió: se queda en un salto más (82,5 kg)');
  check(unSaltoComoMucho(propuesta, l, { nombre: 'Press banca', reglas: RN, sube: false }).series_detalle[1].kg === 80, 'si la fila no sube, se queda en lo que movió');
  check(unSaltoComoMucho({ ...propuesta, backoff_pct: null, carga_sugerida_kg: 100 }, { hechas: [S(1, 100, 8), S(2, 100, 8), S(3, 97.5, 8)] }, { nombre: 'Press banca', reglas: RN }) === null, 'si ya cumple, no toca nada');
  check(Object.keys(FRENO_POR_SU_CUENTA).join(',') === 'desde_lo_hecho,minimo_rango,baja_rango,un_salto', 'los frenos tienen su texto para el coach');
}

console.log('Con seguimiento no cambia nada');
{
  const ejercicios = { banca, jalon };
  const pautas = [P({ id: 'a', series: 3, carga_sugerida_kg: null, series_detalle: detalle(3, 8, 100) }), P({ id: 'b', ejercicio_id: 'jalon', orden: 2, prioridad: 'media', series: 2, reps_min: 10, reps_max: 12, carga_sugerida_kg: 50 })];
  const sesiones = [{ id: 's1', orden: 1, completada: true }];
  const series = { a: [S(1, 80, 8, 9.5), S(2, 80, 8, 9.5), S(3, 80, 8, 9.5)], b: [S(1, 50, 6, 9.5), S(2, 50, 6, 9.5)] };
  const historial = { b: [{ foco: null, pauta: pautas[1], series: [S(1, 50, 6, 9.5), S(2, 50, 6, 9.5)] }] };
  const sin = proponerSemana({ pautas, sesiones, series, ejercicios, historial, atleta: { nivel: 'intermedio' } });
  const otra = proponerSemana({ pautas, sesiones, series, ejercicios, historial, atleta: { nivel: 'intermedio', modalidad: 'acompanado' } });
  const sola = proponerSemana({ pautas, sesiones, series, ejercicios, historial, atleta: { nivel: 'intermedio', modalidad: 'por_su_cuenta' } });
  check(igual(sin, otra), 'cualquier modalidad que no sea «por_su_cuenta» da exactamente la misma propuesta');
  check(!igual(sin.filas, sola.filas) && sola.filas[0].propuesta.series_detalle[0].kg === 80 && sola.filas[1].propuesta.series_detalle[0].kg === 47.5, 'y por su cuenta los frenos actúan en la semana entera');
  const semana = proponerSemana({ pautas, sesiones: [{ id: 's1', orden: 1, completada: true }, { id: 's2', orden: 2, completada: false }, { id: 's3', orden: 3, completada: false }], series, ejercicios, atleta: { nivel: 'intermedio', modalidad: 'por_su_cuenta' } });
  check(semana.semana.tipo === 'repetir' && semana.filas[0].propuesta.series_detalle[0].kg === 80, 'semana a medias por su cuenta: se repite desde lo que movió');
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
