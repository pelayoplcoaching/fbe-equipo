// «Programar según FBE» (fase 0): reglas, lectura, modelos, semana y la propuesta completa. Lógica pura.
//   node test/motor.test.mjs
import { REGLAS_FBE, PERFILES, resolverReglas, fusionar, limpiarReglas, modeloDe, esBasico, MODELOS_DISPONIBLES,
  leerEjercicio, tendencia, textoHecho, saltoDe, cumpleCriterio, SIN_DATOS,
  porSerie, rangoDe, doble, triple, lineal, soloReps, campos, completoLineal, falloLineal, MODELO_BASE,
  aplicarDescarga, senalesDescarga, tramoVuelta, aplicarVuelta, aplicarMantenimiento, diasParado, esMalDia,
  proponerSemana, cargaZona } from '../web/src/logica/motor/index.js';

let ok = 0, fallos = 0;
const check = (c, m) => { if (c) { ok++; console.log('  ✓', m); } else { fallos++; console.log('  ✗', m); } };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const congelar = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };

// Una pauta y una serie con lo mínimo
const P = (extra = {}) => ({ id: 'p1', sesion_id: 's1', ejercicio_id: 'banca', orden: 1, prioridad: 'alta', series: 3, reps_min: 8, reps_max: 12,
  rir_objetivo: null, rpe_objetivo: 8, carga_sugerida_kg: 80, backoff_pct: null, series_detalle: null, ...extra });
const S = (numero, kg, reps, rpe = null, extra = {}) => ({ numero, kg, reps, rpe, rir: null, ...extra });
const R = REGLAS_FBE;
const conReglas = (capa) => fusionar(R, capa);
const leer = (pauta, series, extra = {}) => leerEjercicio({ pauta, series, nombre: 'Press banca', reglas: R, ...extra });

console.log('Reglas');
{
  const r = resolverReglas({ nivel: 'intermedio' });
  check(r.doble.criterio === 'todas_menos_una' && r.descarga.cuando === 'senales' && r.molestias === 'avisar' && r.escala === 'rpe', 'las reglas de partida llevan las decisiones del 5/11');
  check(['novato', 'novato_intermedio', 'intermedio', 'avanzado', null].every((n) => resolverReglas({ nivel: n }).modelos.basico === 'por_serie' && resolverReglas({ nivel: n }).modelos.resto === 'por_serie') && MODELO_BASE === 'por_serie', 'todos los niveles parten de la progresión serie a serie');
  check(resolverReglas({ perfil: 'novato_lineal' }).modelos.basico === 'lineal' && resolverReglas({ perfil: 'intermedio_fuerza' }).modelos.basico === 'top_set' && resolverReglas({}).perfil === 'novato_intermedio', 'los demás modelos siguen como perfiles opcionales');
  const ps = resolverReglas({}).porSerie;
  check(igual(ps.rangos, { basico: [6, 10], multiarticular: [8, 12], aislamiento: [10, 15] }) && ps.sobradoRpe === 7 && ps.sobradoEn === 'basicos' && ps.rpeSube === 9 && ps.variasAlTope === 'faciles' && ps.topeFacilRpe === 8 && ps.sinKilos === 'solo_reps', 'las reglas serie a serie de Pelayo, de partida');
  check(resolverReglas({ perfil: 'readaptacion' }).rpeMax === 7 && resolverReglas({ perfil: 'readaptacion' }).descarga.tipo === 'intensidad', 'el perfil manda sobre el nivel y trae su tope de RPE');
  const h = resolverReglas({ nivel: 'intermedio', fbe: { doble: { margen: 1 } }, atleta: { doble: { criterio: 'todas' } }, bloque: { descarga: { tipo: 'volumen' } }, ejercicio: { doble: { criterio: 'primera' }, modelo: 'triple' } });
  check(h.doble.criterio === 'primera' && h.doble.margen === 1 && h.descarga.tipo === 'volumen' && h.modelo === 'triple' && h.doble.sobrado === 1, 'herencia: FBE → atleta → bloque → ejercicio, mezclando clave a clave');
  check(fusionar({ a: 1, b: { c: 2 } }, { a: null, b: { d: 3 } }).a === 1 && igual(fusionar({ b: { c: 2 } }, { b: { d: 3 } }).b, { c: 2, d: 3 }), 'null no pisa y los objetos se mezclan');
  check(igual(fusionar({ v: [1, 2] }, { v: [3] }).v, [3]), 'las listas se sustituyen');
  check(Object.isFrozen(REGLAS_FBE) && REGLAS_FBE.doble.criterio === 'todas_menos_una', 'resolver no cambia las reglas FBE');
  const l = limpiarReglas({ doble: { criterio: 'todas', margen: 9, raro: 1 }, descarga: { cuando: 'nunca' }, molestias: 'grave', inventada: true, modelo: 'apre',
    vuelta: [{ desde: 14, kgPct: 20, series: 1 }, { desde: 7, kgPct: 10, series: 1 }] });
  check(igual(l.reglas.doble, { criterio: 'todas' }) && !l.reglas.descarga && l.reglas.molestias === 'grave' && l.reglas.modelo === 'apre', 'limpiar: se queda con lo que entiende y dentro de rango');
  check(l.descartado.includes('doble.margen') && l.descartado.includes('doble.raro') && l.descartado.includes('descarga.cuando') && l.descartado.includes('inventada'), 'limpiar: dice lo que ha descartado');
  check(l.reglas.vuelta[0].desde === 7 && l.reglas.vuelta[1].rpeMax === null, 'limpiar: los tramos de vuelta quedan ordenados');
  check(limpiarReglas({ vuelta: [{ desde: 0 }] }).descartado.includes('vuelta') && igual(limpiarReglas(null).reglas, {}), 'limpiar: tramos mal hechos fuera; nada si no hay capa');
  check(limpiarReglas({ triple: { seriesMin: 5, seriesMax: 3 } }).descartado.includes('triple.seriesMin'), 'limpiar: mínimo de series por encima del máximo, fuera');
  check(esBasico({ tipo: ['basico', 'multiarticular'] }) && !esBasico({ tipo: ['aislamiento'] }) && !esBasico(null), 'básico: por el tipo de la biblioteca');
  check(modeloDe({ ejercicio: { tipo: ['basico'] }, reglas: resolverReglas({ perfil: 'novato_lineal' }) }).modelo === 'lineal' && modeloDe({ ejercicio: { tipo: ['aislamiento'] }, reglas: resolverReglas({ perfil: 'novato_lineal' }) }).modelo === 'doble', 'modelo: según sea básico o no');
  const m = modeloDe({ ejercicio: { tipo: ['basico'] }, reglas: resolverReglas({ perfil: 'intermedio_fuerza' }) });
  check(m.modelo === 'por_serie' && m.pedido === 'top_set' && m.pendiente, 'modelo que aún no está: se usa el de partida y se dice');
  const lp = limpiarReglas({ porSerie: { rango: [6, 8], rangos: { basico: [3, 6], raro: [1, 2], aislamiento: [15, 10] }, rpeSube: 8.5, sinKilos: 'nunca', variasAlTope: 'primera' } });
  check(igual(lp.reglas.porSerie, { rango: [6, 8], rangos: { basico: [3, 6] }, rpeSube: 8.5, variasAlTope: 'primera' }) && lp.descartado.includes('porSerie.sinKilos') && lp.descartado.includes('porSerie.rangos.aislamiento'), 'limpiar: rangos y opciones de la progresión serie a serie');
  check(modeloDe({ ejercicio: { tipo: ['basico'] }, reglas: resolverReglas({ nivel: 'novato', ejercicio: { modelo: 'a_mano' } }) }).modelo === 'a_mano', 'el modelo del ejercicio manda sobre el del perfil');
  check(MODELOS_DISPONIBLES.every((k) => typeof { por_serie: porSerie, doble, triple, lineal, solo_reps: soloReps, mantener: 1, a_mano: 1 }[k] !== 'undefined'), 'cada modelo disponible tiene su función');
  check(Object.values(PERFILES).every((p) => p.nombre && p.modelos.basico && p.modelos.resto), 'todos los perfiles traen nombre y modelos');
}

console.log('\nLectura: diagnósticos');
{
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 11, 8.5)]).diagnostico === 'superado', 'todas menos una al tope y la otra en rango: superado');
  check(leerEjercicio({ pauta: P(), series: [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 11, 8.5)], nombre: 'Press banca', reglas: conReglas({ doble: { criterio: 'todas' } }) }).diagnostico === 'en_rango', 'con el criterio «todas», eso mismo es en rango');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 11, 8), S(3, 80, 10, 8)]).diagnostico === 'en_rango', 'dos series sin llegar al tope: en rango');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 7, 8)]).diagnostico === 'por_debajo', 'la que falta, bajo el mínimo: por debajo');
  check(leer(P({ series: 1 }), [S(1, 80, 11, 8)]).diagnostico === 'en_rango' && leer(P({ series: 1 }), [S(1, 80, 12, 8)]).diagnostico === 'superado', 'con una sola serie, esa debe llegar');
  check(leer(P(), [S(1, 80, 12, 6), S(2, 80, 12, 6), S(3, 80, 12, 6)]).diagnostico === 'sobrado', 'dos puntos por debajo del RPE objetivo en todas: sobrado');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 12, 9.5)]).diagnostico === 'pasado', 'más de un punto por encima del objetivo: pasado');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8.5), S(3, 80, 12, 8.5)]).diagnostico === 'superado', 'medio punto por encima entra en el margen');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 9), S(3, 80, 12, 9)]).diagnostico === 'en_rango', 'un punto por encima: ni superado ni pasado');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8)]).diagnostico === 'a_medias', 'menos series de las pautadas: a medias');
  check(leer(P(), []).diagnostico === 'sin_registrar' && leer(P(), [S(1, 40, 10, 8, { sustituto_id: 'x' })]).diagnostico === 'cambiado', 'sin series y cambiado por otro');
  check(leer(P({ reps_min: null, reps_max: null }), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 12, 8)]).diagnostico === 'sin_rango', 'sin repeticiones pautadas no hay con qué comparar');
  check(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 75, 12, 8)]).diagnostico === 'en_rango', 'bajar la carga en la última serie no cuenta como llegar');
  const top = leer(P({ series: 4, reps_min: 4, reps_max: 6, backoff_pct: 10 }), [S(1, 100, 6, 8), S(2, 90, 5, 8), S(3, 90, 4, 8), S(4, 90, 4, 9)]);
  check(top.diagnostico === 'superado' && top.top && top.n === 1 && top.kgTrabajo === 100, 'top + back-off: solo cuenta la top');
  check(leer(P({ rpe_objetivo: null, rir_objetivo: 2 }), [S(1, 80, 12, null, { rir: 2 }), S(2, 80, 12, null, { rir: 2 }), S(3, 80, 12, null, { rir: 1.5 })]).diagnostico === 'superado', 'lee igual el RIR que el RPE');
}

console.log('\nLectura: banderas y datos raros');
{
  const sin = leer(P(), [S(1, 80, 12), S(2, 80, 12), S(3, 80, 12)]);
  check(sin.diagnostico === 'superado' && sin.banderas.sinEsfuerzo, 'sin RPE apuntado decide por repeticiones y lo marca');
  check(leer(P(), [S(1, 85, 10, 8), S(2, 85, 9, 8), S(3, 85, 9, 8)]).banderas.otraCarga === 5, 'trabajó con otra carga que la pautada');
  check(leer(P(), [S(1, 81, 10, 8), S(2, 81, 9, 8), S(3, 81, 9, 8)]).banderas.otraCarga === 0, 'menos de un salto de diferencia no es otra carga');
  const rara = leer(P(), [S(1, 80, 12, 8), S(2, 8, 12, 8), S(3, 80, 12, 8)]);
  check(igual(rara.banderas.raras, [2]) && rara.hechas.length === 2 && rara.diagnostico === 'a_medias', 'una serie con 8 kg en vez de 80 se descarta y se marca');
  check(leer(P({ series: 1 }), [S(1, 800, 12, 8)]).diagnostico === 'dato_raro', 'si todo lo apuntado es raro: dato raro');
  check(leer(P(), [S(1, 80, 30, 8), S(2, 80, 12, 8), S(3, 80, 12, 8)]).banderas.raras.length === 1, 'más del doble del tope de repeticiones es raro');
  const mancuerna = leerEjercicio({ pauta: P({ carga_sugerida_kg: 5 }), series: [S(1, 7, 12, 8), S(2, 7, 12, 8), S(3, 7, 12, 8)], nombre: 'Elevaciones laterales con mancuernas', reglas: R });
  check(!mancuerna.banderas.raras.length && mancuerna.banderas.otraCarga === 2, 'con cargas ligeras, 2 kg más no es una errata');
  check(leer(P(), [S(1, 110, 8, 8), S(2, 110, 8, 8), S(3, 110, 8, 8)], { ultimaVez: 110 }).banderas.raras.length === 0, 'lejos de lo pautado pero igual que la última vez: no es raro');
  check(leer(P(), [S(1, 110, 8, 8), S(2, 110, 8, 8), S(3, 110, 8, 8)], { ultimaVez: 80 }).diagnostico === 'dato_raro', 'lejos de lo pautado y de la última vez: raro');
  check(leer(P({ carga_sugerida_kg: null }), [S(1, 0, 12, 8), S(2, null, 12, 8), S(3, 0, 11, 8)]).diagnostico === 'superado', 'peso corporal: sin kilos también se lee');
  check(leer(P(), [S(1, 80, 12, 8)], { malDia: true }).banderas.malDia, 'el mal día viaja en las banderas');
  check(textoHecho([S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 11, 9)]) === '80 kg × 12, 12, 11 @8–9' && textoHecho([S(1, 0, 10)]) === '10 rep' && textoHecho([S(1, 80, 12), S(2, 75, 10)]) === '80×12 · 75×10', 'lo hecho, en una línea');
  check(saltoDe('Press banca', 80, R) === 2.5 && saltoDe('Curl con mancuernas', 10, R) === 2 && saltoDe('x', 80, conReglas({ salto: { tipo: 'kg', valor: 1 } })) === 1 && saltoDe('x', 100, conReglas({ salto: { tipo: 'pct', valor: 2.5 } })) === 2.5, 'salto: el del ejercicio, kilos fijos o un %');
  const c = { trabajo: [S(1, 80, 12), S(2, 80, 11), S(3, 80, 10)], n: 3, repsMin: 8, repsMax: 12 };
  check(cumpleCriterio('primera', c) && !cumpleCriterio('todas_menos_una', c) && cumpleCriterio('suma', c) && !cumpleCriterio('todas', c), 'los cuatro criterios de subida');
}

console.log('\nLectura: serie a serie');
{
  const D = (d) => P({ series: d.length, series_detalle: d, reps_min: Math.min(...d.map((x) => x.reps)), reps_max: Math.max(...d.map((x) => x.reps)), carga_sugerida_kg: d[0].kg ?? null });
  const d3 = [{ reps: 10, kg: 60, rpe: 8 }, { reps: 10, kg: 60, rpe: 8 }, { reps: 8, kg: 62.5, rpe: 9 }];
  const a = leer(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 8), S(3, 62.5, 8, 9)]);
  check(a.diagnostico === 'superado' && a.detalle && a.alTope === 3, 'cumplir cada serie con su objetivo: superado');
  check(leer(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 8), S(3, 62.5, 7, 9)]).diagnostico === 'superado', 'todas menos una, y a la otra le falta una repetición: superado');
  check(leer(D(d3), [S(1, 60, 10, 8), S(2, 60, 9, 8), S(3, 62.5, 7, 9)]).diagnostico === 'en_rango', 'dos series que no cumplen: repite');
  check(leer(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 8), S(3, 62.5, 6, 9)]).diagnostico === 'por_debajo', 'quedarse a dos repeticiones: por debajo');
  check(leer(D(d3), [S(1, 60, 10, 9.5), S(2, 60, 10, 8), S(3, 62.5, 8, 9)]).diagnostico === 'pasado', 'pasarse de esfuerzo en una serie: pasado');
  check(leer(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 8)]).diagnostico === 'a_medias', 'falta una serie: a medias');
  check(leer(D(d3), [S(1, 57.5, 10, 8), S(2, 57.5, 10, 8), S(3, 57.5, 8, 8)]).diagnostico === 'en_rango', 'hacer las repeticiones con menos kilos no cumple');
  const sinKg = leer(D([{ reps: 12, rpe: 8 }, { reps: 12, rpe: 8 }]), [S(1, 20, 12, 8), S(2, 20, 12, 8)]);
  check(sinKg.diagnostico === 'superado' && sinKg.kgTrabajo === 20, 'serie a serie sin kilos pautados (elige el atleta)');
}

console.log('\nTendencia');
check(tendencia([100, 102, 104, 106]) === 'subiendo', 'un 2 % por semana: subiendo');
check(tendencia([100, 100.2, 100.3, 100.4]) === 'estable', 'apenas se mueve: estable');
check(tendencia([100, 99, 100, 99.8]) === 'estancado', 'tres semanas sin superar lo anterior: estancado');
check(tendencia([100, 102, 100, 98]) === 'bajando', 'dos semanas seguidas a la baja: bajando');
check(tendencia([100, 101]) === null && tendencia([null, 100, null, 101]) === null && tendencia([]) === null, 'con menos de tres semanas no hay tendencia');
check(tendencia([100, 100, 99.8]) === 'estable', 'una bajada de redondeo no es bajar');

console.log('\nModelo: progresión serie a serie');
{
  const multi = { nombre: 'Press inclinado en máquina', tipo: ['multiarticular'], grupos_musculares: ['pectoral'] };
  const basico = { nombre: 'Sentadilla barra alta', tipo: ['basico', 'multiarticular'], grupos_musculares: ['cuadriceps'] };
  const D = (d, extra = {}) => P({ series: d.length, series_detalle: d, reps_min: Math.min(...d.map((x) => x.reps)), reps_max: Math.max(...d.map((x) => x.reps)), carga_sugerida_kg: d[0].kg ?? null, rpe_objetivo: null, ...extra });
  const ps = (pauta, series, ejercicio = multi, extra = {}) => porSerie(leerEjercicio({ pauta, series, nombre: ejercicio.nombre, reglas: extra.reglas || R }), pauta, { nombre: ejercicio.nombre, reglas: R, ejercicio, nivel: 'novato', ...extra });
  const forma = (r) => r.propuesta.series_detalle.map((x) => `${x.reps}×${x.kg ?? '–'}`).join(' ');
  check(igual(rangoDe({ pauta: D([{ reps: 10, kg: 60 }]), ejercicio: basico, reglas: R }), [6, 10]) && igual(rangoDe({ pauta: D([{ reps: 10 }]), ejercicio: { tipo: ['aislamiento'] }, reglas: R }), [10, 15])
    && igual(rangoDe({ pauta: D([{ reps: 10 }]), ejercicio: { tipo: ['multiarticular', 'aislamiento'] }, reglas: R }), [8, 12]) && igual(rangoDe({ pauta: D([{ reps: 10 }]), ejercicio: null, reglas: R }), [8, 12]), 'rango por tipo: básicos 6–10, multiarticulares 8–12, aislamiento 10–15');
  check(igual(rangoDe({ pauta: P({ reps_min: 5, reps_max: 8 }), ejercicio: multi, reglas: R }), [5, 8]) && igual(rangoDe({ pauta: P({ reps_min: 5, reps_max: 8 }), ejercicio: multi, reglas: conReglas({ porSerie: { rango: [12, 20] } }) }), [12, 20])
    && igual(rangoDe({ pauta: P({ reps_min: 5, reps_max: 8 }), ejercicio: multi, reglas: conReglas({ porSerie: { rangoDeLaPauta: false } }) }), [8, 12]), 'manda el rango del ejercicio; si no, el de la pauta; si no, el del tipo');
  const d3 = [{ reps: 10, kg: 60 }, { reps: 10, kg: 60 }, { reps: 10, kg: 60 }];
  const a = ps(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 9), S(3, 60, 10, 9.5)]);
  check(a.tipo === 'reps' && forma(a) === '11×60 11×60 10×60' && a.motivo === 'Series 1 y 2: una repetición más · serie 3: igual (RPE por encima de 9)', 'RPE hasta 9: una repetición más; por encima, igual');
  const b = ps(D([{ reps: 12, kg: 60 }, { reps: 12, kg: 60 }, { reps: 11, kg: 60 }]), [S(1, 60, 12, 9), S(2, 60, 12, 9), S(3, 60, 11, 9)]);
  check(b.tipo === 'subir' && forma(b) === '8×65 12×60 12×60' && b.motivo.startsWith('Serie 1: al tope (12), sube 5 kg y vuelve a 8 · serie 2: al tope (12) pero justa'), 'al tope: sube kilos y vuelve al suelo; de las justas, solo la primera');
  check(forma(ps(D(d3), [S(1, 60, 12, 8), S(2, 60, 12, 8), S(3, 60, 12, 7.5)])) === '8×65 8×65 8×65', 'varias al tope y fáciles (RPE 8 o menos): suben todas');
  check(forma(ps(D(d3), [S(1, 60, 12, 10), S(2, 60, 12, 10), S(3, 60, 12, 8)])) === '8×65 12×60 8×65', 'al tope sube aunque fuera a RPE 10 (la primera) y las fáciles');
  check(forma(ps(D(d3), [S(1, 60, 12, 9), S(2, 60, 12, 9), S(3, 60, 12, 9)], multi, { reglas: conReglas({ porSerie: { variasAlTope: 'todas' } }) })) === '8×65 8×65 8×65'
    && forma(ps(D(d3), [S(1, 60, 12, 7), S(2, 60, 12, 7), S(3, 60, 12, 7)], multi, { reglas: conReglas({ porSerie: { variasAlTope: 'primera' } }) })) === '8×65 12×60 12×60', 'las otras dos reglas para varias al tope');
  const sq = [{ reps: 8, kg: 100 }, { reps: 8, kg: 100 }, { reps: 8, kg: 100 }];
  const c = ps(D(sq), [S(1, 100, 8, 6), S(2, 100, 8, 7), S(3, 100, 8, 8)], basico);
  check(forma(c) === '8×102.5 8×102.5 9×100' && c.motivo.startsWith('Series 1 y 2: sobrada (RPE 7 o menos), sube 2,5 kg con las mismas repeticiones'), 'básico sobrado (RPE 7 o menos): sube kilos con las mismas repeticiones');
  check(forma(ps(D(d3), [S(1, 60, 10, 6), S(2, 60, 10, 6), S(3, 60, 10, 6)])) === '11×60 11×60 11×60', 'fuera de los básicos, ir sobrado solo suma una repetición');
  const baja = ps(D([{ reps: 4, kg: 140 }, { reps: 4, kg: 140 }]), [S(1, 140, 4, 8.5), S(2, 140, 4, 7)], basico);
  check(forma(baja) === '4×140 4×142.5' && baja.motivo.includes('por debajo del rango (6–10), igual'), 'por debajo del rango (intensificación): no empuja repeticiones; sobrada, sube kilos');
  const acc = D([{ reps: 10, kg: 20 }, { reps: 12, kg: 20 }], { prioridad: 'baja' });
  const e = ps(acc, [S(1, 22, 10, 8), S(2, 22, 12, 8)], multi, { nivel: 'intermedio' });
  check(forma(e) === '11×22 12×22' && e.tipo === 'reps' && e.avisos[0] === 'Ha llegado al tope en la serie 2: le toca subir de carga', 'donde la carga la elige el atleta: solo repeticiones, con los kilos que él usó');
  check(igual(ps(acc, [S(1, 22, 10, 8), S(2, 22, 12, 8)], multi, { nivel: 'intermedio', reglas: conReglas({ porSerie: { sinKilos: 'no_tocar' } }) }).propuesta, campos(acc)), 'con la regla de no tocarlos: se queda igual');
  check(forma(ps(acc, [S(1, 22, 10, 8), S(2, 22, 12, 8)], multi, { nivel: 'intermedio', reglas: conReglas({ porSerie: { sinKilos: 'como_los_demas' } }) })) === '11×22 8×24.5' && forma(ps(acc, [S(1, 22, 10, 8), S(2, 22, 12, 8)], multi, { nivel: null })) === '11×22 8×24.5', 'progresarlos como los demás, o sin nivel: también kilos');
  const piramide = P({ series: 3, reps_min: 8, reps_max: 12, carga_sugerida_kg: 80, rpe_objetivo: null });
  const f = ps(piramide, [S(1, 90, 8, 8.5), S(2, 80, 10, 8), S(3, 80, 12, 8)]);
  check(forma(f) === '9×90 11×80 8×85' && f.propuesta.series === 3 && f.propuesta.backoff_pct === null && f.alternativas[0].propuesta.series_detalle === null, 'una pauta que no era serie a serie sale serie a serie, desde lo que hizo en cada serie');
  const g = ps(piramide, [S(1, 80, 12, 10), S(2, 80, 11, 10), S(3, 80, 10, 10)], multi, { reglas: conReglas({ porSerie: { variasAlTope: 'primera', rango: [8, 20] } }) });
  check(g.tipo === 'mantener' && igual(g.propuesta, campos(piramide)) && g.alternativas.length === 0, 'todo a RPE 10 en una pauta que no era serie a serie: se queda como la escribiste');
  const gd = ps(D(d3), [S(1, 60, 11, 10), S(2, 60, 10, 10), S(3, 60, 9, 10)]);
  check(forma(gd) === '11×60 10×60 10×60' && gd.tipo === 'mantener', 'todo a RPE 10 serie a serie: queda lo que hizo donde cumplió y lo pautado donde no');
  const igualP = P({ series: 2, reps_min: 10, reps_max: 10, carga_sugerida_kg: 50, rpe_objetivo: null });
  const h = ps(igualP, [S(1, 50, 10, 10), S(2, 50, 10, 10)]);
  check(h.tipo === 'mantener' && igual(h.propuesta, campos(igualP)) && h.alternativas.length === 0, 'si nada cambia, la pauta se queda en su formato');
  check(forma(ps(D(d3), [S(1, 60, 10), S(2, 60, 10), S(3, 60, 10)])) === '11×60 11×60 11×60', 'sin RPE apuntado: una repetición más');
  const falta = ps(D(d3), [S(1, 60, 10, 8), S(2, 60, 10, 8)]);
  check(forma(falta) === '11×60 11×60 10×60' && falta.motivo.endsWith('serie 3: sin hacer, igual'), 'una serie sin hacer se queda como estaba');
  check(forma(ps(D(d3), [S(1, 62.5, 10, 8), S(2, 60, 9, 9.5), S(3, 60, 10, 9.5)])) === '11×62.5 10×60 10×60', 'parte de los kilos que movió; la que no cumplió y fue dura repite lo pautado');
  const cuerpo = ps(D([{ reps: 10 }, { reps: 10 }]), [S(1, 0, 12, 8), S(2, 0, 10, 8)]);
  check(forma(cuerpo) === '12×– 11×–' && cuerpo.avisos.length === 1, 'sin kilos (peso corporal): repeticiones y aviso al llegar al tope');
  const topP = P({ series: 4, reps_min: 4, reps_max: 6, backoff_pct: 10, carga_sugerida_kg: 100 });
  const t = ps(topP, [S(1, 100, 6, 8), S(2, 90, 5, 8), S(3, 90, 4, 8), S(4, 90, 4, 9)], basico);
  check(t.propuesta.carga_sugerida_kg === 102.5 && t.propuesta.backoff_pct === 10 && t.avisos.some((x) => x.includes('top + back-off')), 'con top + back-off sigue la doble progresión sobre la top');
  check(ps(D(d3), []).tipo === 'mantener' && ps(D(d3), [S(1, 600, 10, 8)]).motivo.includes('errata'), 'sin registrar o con erratas: se mantiene');
  check(igual(D(d3).series_detalle, d3), 'la pauta original no se toca');
}

console.log('\nModelo: doble progresión');
{
  const ctx = { nombre: 'Press banca', reglas: R, previa: null };
  const sube = doble(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 11, 8.5)]), P(), ctx);
  check(sube.tipo === 'subir' && sube.propuesta.carga_sugerida_kg === 82.5 && sube.propuesta.reps_min === 8 && sube.propuesta.reps_max === 12, 'superado: un salto más, mismo rango');
  check(sube.motivo === 'Llegó a 12 en 2 de 3 series sin pasarse de esfuerzo: sube 2,5 kg' && sube.alternativas[0].id === 'mantener' && sube.alternativas[0].propuesta.carga_sugerida_kg === 80, 'el motivo en una frase y «Mantener» de alternativa');
  const man = doble(leerEjercicio({ pauta: P({ carga_sugerida_kg: 20 }), series: [S(1, 20, 12, 8), S(2, 20, 12, 8), S(3, 20, 12, 8)], nombre: 'Press con mancuernas', reglas: R }), P({ carga_sugerida_kg: 20 }), { ...ctx, nombre: 'Press con mancuernas' });
  check(man.propuesta.carga_sugerida_kg === 22, 'mancuernas: salto de 2 kg');
  const libre = doble(leer(P({ carga_sugerida_kg: null }), [S(1, 40, 12, 8), S(2, 40, 12, 8), S(3, 40, 12, 8)]), P({ carga_sugerida_kg: null }), ctx);
  check(libre.tipo === 'subir' && libre.propuesta.carga_sugerida_kg === null && libre.orientativa === 42.5 && libre.motivo.includes('orientativo: 42,5 kg'), 'pauta sin kilos: no se inventan, la carga queda orientativa');
  const otra = doble(leer(P(), [S(1, 85, 12, 8), S(2, 85, 12, 8), S(3, 85, 12, 8)]), P(), ctx);
  check(otra.propuesta.carga_sugerida_kg === 87.5, 'si trabajó con más de lo pautado, se parte de lo que hizo');
  const reps = doble(leer(P(), [S(1, 80, 11, 8), S(2, 80, 10, 8), S(3, 80, 9, 8)]), P(), ctx);
  check(reps.tipo === 'reps' && reps.propuesta.carga_sugerida_kg === 80 && reps.alternativas[0].id === 'subir' && reps.motivo.includes('11, 10, 9 de 8–12'), 'en rango: misma carga y a sumar repeticiones');
  const corta = leer(P(), [S(1, 80, 9, 8), S(2, 80, 8, 8), S(3, 80, 6, 8)]);
  const una = doble(corta, P(), ctx);
  check(una.tipo === 'mantener' && una.propuesta.carga_sugerida_kg === 80 && una.alternativas[0].id === 'bajar', 'por debajo una semana: repite, con «Bajar» a mano');
  const dosVeces = doble(corta, P(), { ...ctx, previa: corta });
  check(dosVeces.tipo === 'bajar' && dosVeces.propuesta.carga_sugerida_kg === 77.5 && dosVeces.motivo === 'Dos semanas sin llegar a 8: baja 2,5 kg', 'por debajo dos semanas seguidas: baja un salto');
  check(doble(corta, P(), { ...ctx, reglas: conReglas({ doble: { porDebajo: 'bajar_pct' } }), previa: corta }).propuesta.carga_sugerida_kg === 72.5, 'con la regla de bajar un %: −10 % al salto');
  check(doble(corta, P(), { ...ctx, reglas: conReglas({ doble: { porDebajo: 'mantener' } }), previa: corta }).tipo === 'mantener', 'con la regla de mantener siempre: no baja');
  const mala = leer(P(), [S(1, 80, 9, 8), S(2, 80, 8, 8), S(3, 80, 6, 8)], { malDia: true });
  check(doble(mala, P(), { ...ctx, previa: corta }).tipo === 'mantener' && doble(corta, P(), { ...ctx, previa: mala }).tipo === 'mantener', 'un mal día no cuenta para bajar, ni esta semana ni la anterior');
  check(doble(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 12, 9.5)]), P(), ctx).tipo === 'mantener', 'pasado de esfuerzo: repite aunque llegara al tope');
  const errata = doble(leer(P(), [S(1, 80, 12, 8), S(2, 8, 12, 8), S(3, 80, 12, 8)]), P(), ctx);
  check(errata.tipo === 'mantener' && errata.motivo === 'La serie 2 parece una errata y con las demás no basta para decidir: se mantiene' && doble(leer(P(), [S(1, 80, 12, 8), S(2, 80, 12, 8)]), P(), ctx).motivo === 'Hizo 2 de 3 series: se mantiene', 'una errata no se cuenta como una serie sin hacer');
  const sob = leer(P(), [S(1, 80, 12, 6), S(2, 80, 12, 6), S(3, 80, 12, 6)]);
  check(doble(sob, P(), ctx).propuesta.carga_sugerida_kg === 82.5 && doble(sob, P(), { ...ctx, reglas: conReglas({ doble: { sobrado: 2 } }) }).propuesta.carga_sugerida_kg === 85, 'sobrado: un salto de partida, dos si las reglas lo dicen');
  const cuerpo = doble(leer(P({ carga_sugerida_kg: null }), [S(1, 0, 12, 8), S(2, 0, 12, 8), S(3, 0, 12, 8)]), P({ carga_sugerida_kg: null }), ctx);
  check(cuerpo.tipo === 'tope' && cuerpo.alternativas[0].propuesta.reps_max === 14 && cuerpo.avisos.length === 1, 'al tope sin carga: avisa y ofrece ampliar el rango');
  check(SIN_DATOS.every((d) => { const r = doble({ ...leer(P(), []), diagnostico: d, hechas: [], n: 3 }, P(), ctx); return r.tipo === 'mantener' && igual(r.propuesta, campos(P())); }), 'sin datos fiables, la pauta se queda como está');
  const topP = P({ series: 4, reps_min: 4, reps_max: 6, backoff_pct: 10, carga_sugerida_kg: 100 });
  const topR = doble(leer(topP, [S(1, 100, 6, 8), S(2, 90, 5, 8), S(3, 90, 4, 8), S(4, 90, 4, 9)]), topP, ctx);
  check(topR.propuesta.carga_sugerida_kg === 102.5 && topR.propuesta.backoff_pct === 10 && topR.motivo.startsWith('Llegó a 6 en la serie top'), 'top + back-off: sube la top y las back-off la siguen');
  const d3 = [{ reps: 10, kg: 60, rpe: 8 }, { reps: 10, kg: 60, rpe: 8 }, { reps: 8, kg: 62.5, rpe: 9 }];
  const pd = P({ series: 3, series_detalle: d3, reps_min: 8, reps_max: 10, carga_sugerida_kg: 60 });
  const rd = doble(leer(pd, [S(1, 60, 10, 8), S(2, 62.5, 10, 8), S(3, 62.5, 8, 9)]), pd, ctx);
  check(igual(rd.propuesta.series_detalle.map((x) => x.kg), [62.5, 65, 65]) && igual(rd.propuesta.series_detalle.map((x) => x.reps), [10, 10, 8]) && rd.propuesta.series === 3, 'serie a serie: sube cada serie, desde lo que hizo si fue más');
  check(igual(pd.series_detalle, d3), 'la pauta original no se toca');
  const rd2 = doble(leer(pd, [S(1, 60, 10, 8), S(2, 60, 9, 8), S(3, 62.5, 7, 9)]), pd, ctx);
  check(rd2.tipo === 'mantener' && igual(rd2.propuesta.series_detalle, d3) && rd2.motivo === 'Cumplió 1 de 3 series pautadas: repite', 'serie a serie sin cumplir: repite tal cual');
}

console.log('\nModelo: triple progresión');
{
  const nombre = 'Elevaciones laterales con mancuernas';
  const p3 = P({ ejercicio_id: 'lat', carga_sugerida_kg: 8, reps_min: 12, reps_max: 15 });
  const hechas = (n) => Array.from({ length: n }, (_, i) => S(i + 1, 8, 15, 8));
  const ctx = { nombre, reglas: R, previa: null, seriesMin: 3, seriesMax: 5 };
  const lee = (p, s) => leerEjercicio({ pauta: p, series: s, nombre, reglas: R });
  const a = triple(lee(p3, hechas(3)), p3, ctx);
  check(a.tipo === 'series' && a.propuesta.series === 4 && a.propuesta.carga_sugerida_kg === 8 && a.motivo.endsWith('una serie más (4 de 5)'), 'al tope con margen de series: una serie más');
  check(a.alternativas.map((x) => x.id).join() === 'subir,mantener' && a.alternativas[0].propuesta.carga_sugerida_kg === 10, 'alternativas: subir kilos o mantener');
  const p5 = { ...p3, series: 5 };
  const b = triple(lee(p5, hechas(5)), p5, ctx);
  check(b.tipo === 'subir' && b.propuesta.carga_sugerida_kg === 10 && b.propuesta.series === 3, 'al tope con todas las series: sube kilos y vuelve al mínimo de series');
  check(triple(lee(p3, [S(1, 8, 14, 8), S(2, 8, 13, 8), S(3, 8, 12, 8)]), p3, ctx).tipo === 'reps', 'sin llegar al tope: a sumar repeticiones');
  const sinLimites = triple(lee(p3, hechas(3)), p3, { nombre, reglas: R, previa: null });
  check(sinLimites.propuesta.series === 4 && sinLimites.motivo.includes('(4 de 5)'), 'sin límites dados: las pautadas y dos más');
  const pd = P({ series: 2, series_detalle: [{ reps: 12, kg: 8 }, { reps: 12, kg: 8 }], reps_min: 12, reps_max: 12, carga_sugerida_kg: 8 });
  const c = triple(lee(pd, [S(1, 8, 12), S(2, 8, 12)]), pd, ctx);
  check(c.tipo === 'subir' && c.avisos.some((x) => x.includes('triple')), 'serie a serie: usa la doble y lo avisa');
}

console.log('\nModelo: lineal');
{
  const p5 = P({ ejercicio_id: 'sent', series: 3, reps_min: 5, reps_max: 5, carga_sugerida_kg: 100, rpe_objetivo: null });
  const nombre = 'Sentadilla barra alta';
  const lee = (s, extra) => leerEjercicio({ pauta: p5, series: s, nombre, reglas: R, ...extra });
  const ctx = { nombre, reglas: R, fallosPrevios: 0, bajadasPrevias: 0 };
  const bien = lee([S(1, 100, 5), S(2, 100, 5), S(3, 100, 5)]);
  const mal = lee([S(1, 100, 5), S(2, 100, 4), S(3, 100, 3)]);
  check(completoLineal(bien) && !falloLineal(bien) && !completoLineal(mal) && falloLineal(mal), 'completar y fallar');
  const a = lineal(bien, p5, ctx);
  check(a.tipo === 'subir' && a.propuesta.carga_sugerida_kg === 102.5 && a.motivo === 'Completó las 3 series: sube 2,5 kg', 'completadas: un salto más');
  check(lineal(mal, p5, ctx).tipo === 'mantener', 'un fallo: repite');
  const b = lineal(mal, p5, { ...ctx, fallosPrevios: 1 });
  check(b.tipo === 'bajar' && b.propuesta.carga_sugerida_kg === 90 && b.avisos.length === 0, 'dos fallos seguidos: −10 %');
  check(lineal(mal, p5, { ...ctx, fallosPrevios: 1, bajadasPrevias: 1 }).avisos[0].includes('doble progresión'), 'a la segunda bajada avisa de cambiar de modelo');
  check(lineal(lee([S(1, 100, 5), S(2, 100, 4), S(3, 100, 3)], { malDia: true }), p5, { ...ctx, fallosPrevios: 1 }).tipo === 'mantener', 'un mal día no cuenta como fallo');
  check(lineal(lee([S(1, 100, 5), S(2, 100, 5)]), p5, ctx).tipo === 'mantener', 'a medias: se mantiene');
  const conRpe = { ...p5, rpe_objetivo: 8 };
  const pasada = leerEjercicio({ pauta: conRpe, series: [S(1, 100, 5, 9.5), S(2, 100, 5, 9.5), S(3, 100, 5, 10)], nombre, reglas: R });
  check(lineal(pasada, conRpe, ctx).tipo === 'mantener' && !falloLineal(pasada), 'completarlas pasándose de esfuerzo: repite y no cuenta como fallo');
}

console.log('\nModelo: solo repeticiones');
{
  const nombre = 'Dominadas pronas';
  const fija = P({ ejercicio_id: 'dom', series: 3, reps_min: 8, reps_max: 8, carga_sugerida_kg: null, rpe_objetivo: null });
  const lee = (p, s) => leerEjercicio({ pauta: p, series: s, nombre, reglas: R });
  const ctx = { nombre, reglas: R };
  const a = soloReps(lee(fija, [S(1, 0, 8), S(2, 0, 8), S(3, 0, 8)]), fija, ctx);
  check(a.tipo === 'reps' && igual(a.propuesta.series_detalle.map((x) => x.reps), [9, 8, 8]) && a.propuesta.carga_sugerida_kg === null && a.propuesta.series === 3, 'fijas y completadas: una repetición más en total (9, 8, 8)');
  const b = soloReps(lee(fija, [S(1, 0, 8), S(2, 0, 8), S(3, 0, 8)]), fija, { nombre, reglas: conReglas({ soloReps: { sube: 'una_cada_serie' } }) });
  check(b.propuesta.reps_min === 9 && b.propuesta.reps_max === 9 && b.propuesta.series_detalle === null, 'con la regla de una en cada serie: 3 × 9');
  check(soloReps(lee(fija, [S(1, 0, 8), S(2, 0, 7), S(3, 0, 6)]), fija, ctx).tipo === 'mantener', 'fijas sin completar: repite');
  const det = P({ ejercicio_id: 'dom', series: 3, series_detalle: [{ reps: 9 }, { reps: 8 }, { reps: 8 }], reps_min: 8, reps_max: 9, carga_sugerida_kg: null, rpe_objetivo: null });
  const c = soloReps(lee(det, [S(1, 0, 9), S(2, 0, 8), S(3, 0, 8)]), det, ctx);
  check(igual(c.propuesta.series_detalle.map((x) => x.reps), [9, 9, 8]), 'serie a serie: sube la más atrasada (9, 9, 8)');
  const rango = P({ ejercicio_id: 'dom', series: 3, reps_min: 6, reps_max: 10, carga_sugerida_kg: null, rpe_objetivo: null });
  const d = soloReps(lee(rango, [S(1, 0, 9), S(2, 0, 8), S(3, 0, 7)]), rango, ctx);
  check(d.tipo === 'reps' && igual(d.propuesta, campos(rango)) && d.motivo === 'Hizo 9, 8, 7 de 6–10: objetivo 9, 8, 8', 'con rango: la pauta no cambia y el motivo da el objetivo');
  const e = soloReps(lee(rango, [S(1, 0, 10), S(2, 0, 10), S(3, 0, 10)]), rango, ctx);
  check(e.tipo === 'tope' && e.alternativas[0].id === 'ampliar', 'con rango y al tope: avisa');
  const lastre = P({ ejercicio_id: 'dom', series: 2, reps_min: 5, reps_max: 5, carga_sugerida_kg: 10, rpe_objetivo: null });
  check(soloReps(lee(lastre, [S(1, 10, 5), S(2, 10, 5)]), lastre, ctx).propuesta.series_detalle.every((x) => x.kg === 10), 'la carga no cambia nunca');
}

console.log('\nSemana: descarga, parón y mantenimiento');
{
  const p = P({ series: 4, carga_sugerida_kg: 100 });
  const lig = aplicarDescarga(p, { tipo: 'ligera', nombre: 'Press banca' });
  check(lig.series === 3 && lig.carga_sugerida_kg === 90 && lig.rpe_objetivo === 7, 'ligera: una serie menos, −10 % y RPE −1');
  const vol = aplicarDescarga(p, { tipo: 'volumen', nombre: 'Press banca' });
  check(vol.series === 2 && vol.carga_sugerida_kg === 100 && vol.rpe_objetivo === 7, 'de volumen: la mitad de las series y mismos kilos');
  const int = aplicarDescarga(p, { tipo: 'intensidad', nombre: 'Press banca' });
  check(int.series === 4 && int.carga_sugerida_kg === 85 && int.rpe_objetivo === 6, 'de intensidad: mismas series, −15 % y RPE −2');
  const tec = aplicarDescarga(p, { tipo: 'tecnica', nombre: 'Press banca' });
  check(tec.series === 3 && tec.carga_sugerida_kg === 80 && tec.rpe_objetivo === 6, 'de técnica: una serie menos, −20 % y RPE máximo 6');
  check(aplicarDescarga(p, { tipo: 'ligera', nombre: 'Press banca', kgBase: 105 }).carga_sugerida_kg === 95, 'parte de los kilos con los que trabajó');
  check(aplicarDescarga(P({ carga_sugerida_kg: null }), { tipo: 'intensidad', kgBase: 50 }).carga_sugerida_kg === null, 'sin kilos pautados no los inventa');
  const top = aplicarDescarga(P({ series: 2, backoff_pct: 10 }), { tipo: 'volumen' });
  check(top.series === 2, 'top + back-off nunca baja de dos series');
  const det = aplicarDescarga(P({ series: 3, series_detalle: [{ reps: 10, kg: 60, rpe: 8 }, { reps: 10, kg: 60, rpe: 8 }, { reps: 8, kg: 62.5, rpe: 9 }] }), { tipo: 'tecnica', nombre: 'Press banca' });
  check(det.series === 2 && det.series_detalle.length === 2 && det.series_detalle[0].kg === 47.5 && det.series_detalle[0].rpe === 6, 'serie a serie: quita la última y recorta cada serie');
  check(aplicarDescarga(P({ rpe_objetivo: null, rir_objetivo: 2 }), { tipo: 'intensidad' }).rir_objetivo === 4, 'con RIR pautado: más reserva');
  check(p.series === 4 && p.carga_sugerida_kg === 100, 'la pauta original no se toca');

  const fila = (prioridad, tend, diagnostico = 'en_rango') => ({ prioridad, tendencia: tend, lectura: { diagnostico, objetivo: 2, reservas: [2] } });
  check(senalesDescarga({}).length === 0, 'sin datos no hay señales');
  check(senalesDescarga({ filas: [fila('alta', 'bajando'), fila('alta', 'bajando'), fila('baja', 'bajando')] })[0].id === 'rendimiento', 'señal: dos obligatorios a la baja');
  check(senalesDescarga({ filas: [fila('alta', 'bajando'), fila('baja', 'bajando')] }).length === 0, 'un obligatorio a la baja no basta');
  const ck = (semana_inicio, energia, recuperacion = 4) => ({ semana_inicio, energia, recuperacion });
  check(senalesDescarga({ checkins: [ck('2026-10-19', 2), ck('2026-10-26', 4, 2)] })[0].id === 'checkin', 'señal: dos check-in bajos seguidos');
  check(senalesDescarga({ checkins: [ck('2026-10-12', 2), ck('2026-10-26', 2)] }).length === 0 && senalesDescarga({ checkins: [ck('2026-10-19', 2), ck('2026-10-26', 4)] }).length === 0, 'no seguidos, o solo uno bajo: no');
  check(senalesDescarga({ carga: { ratio: 1.6 } })[0].id === 'carga' && senalesDescarga({ carga: { ratio: 1.4 } }).length === 0, 'señal: pico de carga de 1,5 veces o más');
  check(senalesDescarga({ filas: [fila('media', null, 'pasado'), fila('media', null, 'pasado'), fila('media', null), fila('media', null)] })[0].id === 'esfuerzo', 'señal: pasado de esfuerzo en la mitad');
  const ses = (prep, completada = true) => ({ completada, preparacion: prep });
  const malo = { sueno: 1, energia: 1, molestias: 2 }, bueno = { sueno: 3, energia: 3, molestias: 3 };
  check(esMalDia(ses(malo)) && !esMalDia(ses(bueno)) && !esMalDia(ses(null)), 'mal día: el nivel más bajo de «¿cómo llegas hoy?»');
  check(senalesDescarga({ sesiones: [ses(malo), ses(malo), ses(bueno), ses(bueno)] })[0].id === 'preparacion' && senalesDescarga({ sesiones: [ses(malo)] }).length === 0, 'señal: llegó mal a la mitad de las sesiones');

  check(tramoVuelta(9) === null && tramoVuelta(10).kgPct === 10 && tramoVuelta(20).kgPct === 20 && tramoVuelta(40).rpeMax === 7 && tramoVuelta(null) === null, 'vuelta: el tramo por días parado');
  const v = aplicarVuelta(p, tramoVuelta(40), { nombre: 'Press banca' });
  check(v.carga_sugerida_kg === 70 && v.series === 3 && v.rpe_objetivo === 7, 'vuelta larga: −30 %, una serie menos y RPE máximo 7');
  check(diasParado(['2026-10-01', '2026-10-20', null], '2026-11-05') === 16 && diasParado([], '2026-11-05') === null, 'días parado desde la última sesión');
  check(aplicarMantenimiento(p).series === 2 && aplicarMantenimiento(p).carga_sugerida_kg === 100 && aplicarMantenimiento(P({ series: 1 })).series === 1, 'mantenimiento: la mitad de las series y mismas cargas');
}

console.log('\nLa propuesta de la semana');
const ejercicios = {
  banca: { id: 'banca', nombre: 'Press banca', grupos_musculares: ['pectoral', 'triceps', 'deltoides'], tipo: ['basico'] },
  sent: { id: 'sent', nombre: 'Sentadilla barra alta', grupos_musculares: ['cuadriceps', 'gluteo'], tipo: ['basico'] },
  lat: { id: 'lat', nombre: 'Elevaciones laterales con mancuernas', grupos_musculares: ['deltoides'], tipo: ['aislamiento'] },
  curl: { id: 'curl', nombre: 'Curl de bíceps con mancuernas', grupos_musculares: ['biceps'], tipo: ['aislamiento'] },
  remo: { id: 'remo', nombre: 'Remo en máquina', grupos_musculares: ['espalda', 'biceps'], tipo: ['multiarticular'] },
};
const semana = () => ({
  sesiones: [{ id: 's1', orden: 1, completada: true, preparacion: { sueno: 3, energia: 3, molestias: 3 } }, { id: 's2', orden: 2, completada: true, preparacion: null }],
  pautas: [
    P({ id: 'a', sesion_id: 's1', ejercicio_id: 'banca', orden: 1, prioridad: 'alta', carga_sugerida_kg: 80 }),
    P({ id: 'b', sesion_id: 's1', ejercicio_id: 'lat', orden: 2, prioridad: 'baja', carga_sugerida_kg: 8, reps_min: 12, reps_max: 15 }),
    P({ id: 'c', sesion_id: 's2', ejercicio_id: 'sent', orden: 1, prioridad: 'alta', carga_sugerida_kg: 100, reps_min: 5, reps_max: 8 }),
    P({ id: 'd', sesion_id: 's2', ejercicio_id: 'curl', orden: 2, prioridad: 'muy_baja', carga_sugerida_kg: null, rpe_objetivo: null, rir_objetivo: 2, reps_min: 10, reps_max: 12 }),
    P({ id: 'e', sesion_id: 's2', ejercicio_id: 'remo', orden: 3, prioridad: 'media', carga_sugerida_kg: 50 }),
  ],
  series: {
    a: [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 12, 8)],
    b: [S(1, 8, 14, 8), S(2, 8, 13, 8), S(3, 8, 12, 8)],
    c: [S(1, 100, 6, 9.5), S(2, 100, 6, 9.5), S(3, 100, 5, 10)],
    d: [S(1, 12, 12, 8), S(2, 12, 12, 8), S(3, 12, 12, 8)],
    e: [],
  },
});
const antesDe = (id, kg, reps) => [{ foco: 'volumen', pauta: P({ ejercicio_id: id, carga_sugerida_kg: kg }), series: reps.map((r, i) => S(i + 1, kg, r, 8)) }];
const historial = { banca: antesDe('banca', 77.5, [12, 12, 12]), lat: antesDe('lat', 8, [13, 12, 12]), sent: antesDe('sent', 97.5, [8, 8, 8]), curl: antesDe('curl', 12, [11, 10, 10]), remo: antesDe('remo', 50, [10, 10, 9]) };
// entradaBase: con el modelo de partida (serie a serie). entrada: forzando la doble progresión por ejercicio, que
// es con lo que se prueban los frenos y la semana.
const entradaBase = (extra = {}) => ({ ...semana(), ejercicios, historial, atleta: { nivel: 'intermedio' }, ...extra });
const entrada = (extra = {}) => entradaBase({ ...extra, reglas: fusionar({ atleta: { modelos: { basico: 'doble', resto: 'doble' } } }, extra.reglas) });
{
  const r = proponerSemana(congelar(entradaBase()));
  const f = Object.fromEntries(r.filas.map((x) => [x.pauta_id, x]));
  check(r.filas.every((x) => x.modelo === 'por_serie'), 'de partida, todo va con la progresión serie a serie');
  check(f.a.tipo === 'subir' && igual(f.a.propuesta.series_detalle, [{ reps: 8, kg: 82.5, rpe: 8 }, { reps: 8, kg: 82.5, rpe: 8 }, { reps: 8, kg: 82.5, rpe: 8 }]) && f.a.cambios.includes('series_detalle'), 'press banca al tope y fácil en las tres: suben las tres y vuelven a 8');
  check(f.b.tipo === 'reps' && igual(f.b.propuesta.series_detalle.map((x) => x.reps), [15, 14, 13]) && f.b.propuesta.series_detalle.every((x) => x.kg === 8), 'laterales (accesorio de un intermedio): solo repeticiones');
  check(f.c.tipo === 'mantener' && !f.c.cambia, 'sentadilla a RPE 9,5–10: no progresa y la pauta no se toca');
  check(f.d.propuesta.rir_objetivo === null && f.d.propuesta.rpe_objetivo === 8 && f.d.propuesta.carga_sugerida_kg === null, 'curl sin kilos pautados: sigue sin kilos y en RPE');
  check(f.e.tipo === 'mantener' && !f.e.cambia, 'remo sin registrar: se mantiene');
}
{
  const e = congelar(entrada());
  const r = proponerSemana(e);
  const f = Object.fromEntries(r.filas.map((x) => [x.pauta_id, x]));
  check(r.filas.map((x) => x.pauta_id).join('') === 'abcde', 'las filas salen en el orden de las sesiones');
  check(f.a.tipo === 'subir' && f.a.propuesta.carga_sugerida_kg === 82.5 && f.a.confianza === 'alta' && igual(f.a.cambios, ['carga_sugerida_kg']) && f.a.cambia, 'press banca: sube con confianza alta');
  check(f.a.hecho === '80 kg × 12, 12, 12 @8' && f.a.antes.carga_sugerida_kg === 80 && f.a.modelo === 'doble', 'cada fila trae lo que hizo y lo que había');
  check(f.b.tipo === 'reps' && !f.b.cambia && f.b.confianza === 'alta', 'laterales: en rango, sin cambios');
  check(f.c.tipo === 'mantener' && f.c.frenos.some((x) => x.id === 'pasado_de_esfuerzo') && f.c.confianza === 'media', 'sentadilla: pasada de esfuerzo, se mantiene y lo marca');
  check(f.d.tipo === 'subir' && f.d.orientativa === 14 && f.d.propuesta.carga_sugerida_kg === null && f.d.propuesta.rpe_objetivo === 8 && f.d.propuesta.rir_objetivo === null && !f.d.cambia,
    'curl sin kilos y pautado en RIR: carga orientativa, sale en RPE y no cuenta como cambio');
  check(f.e.tipo === 'mantener' && f.e.confianza === 'baja' && f.e.frenos.some((x) => x.id === 'sin_registrar') && igual(f.e.propuesta, f.e.antes), 'remo sin registrar: se mantiene, confianza baja');
  check(r.semana.tipo === 'normal' && igual([r.semana.resumen.suben, r.semana.resumen.mantienen, r.semana.resumen.bajan], [2, 3, 0]) && igual(r.semana.resumen.confianza, { alta: 3, media: 1, baja: 1 }), 'la semana de un vistazo');
  check(r.semana.resumen.seriesPorGrupo.antes.deltoides === 4.5 && r.semana.resumen.seriesPorGrupo.despues.deltoides === 4.5, 'series por músculo antes y después (secundarios a 0,5)');
  check(!r.descarga.propuesta && r.descarga.senales.length === 0 && r.descarga.filas === null, 'sin señales no se propone descarga');
  check(igual(proponerSemana(e), r), 'con los mismos datos, la misma propuesta');
  check(igual(e, entrada()), 'no cambia nada de lo que recibe');
  check(f.a.tendencia === null && f.a.alternativas.length === 1 && f.a.alternativas[0].propuesta.carga_sugerida_kg === 80, 'tendencia sin datos suficientes y alternativa de un toque');
}
{
  const r = proponerSemana(entrada({ historial: {} }));
  check(r.filas.find((x) => x.pauta_id === 'a').confianza === 'baja', 'sin semanas anteriores (ejercicio nuevo): confianza baja');
  const vacio = proponerSemana();
  check(vacio.filas.length === 0 && vacio.semana.tipo === 'normal', 'sin datos no falla');
}
{
  const e = entrada();
  e.sesiones[1].completada = false; e.sesiones.push({ id: 's3', orden: 3, completada: false }, { id: 's4', orden: 4, completada: false });
  const r = proponerSemana(e);
  check(r.semana.tipo === 'repetir' && r.filas.every((x) => !x.cambia && x.tipo === 'mantener' && x.confianza === 'baja') && r.filas[0].motivo === 'Semana a medias (1 de 4 sesiones): se repite tal cual', 'semana a medias: se repite tal cual');
}
{
  const r = proponerSemana(entrada({ contexto: { diasSinEntrenar: 16 } }));
  const a = r.filas.find((x) => x.pauta_id === 'a');
  check(r.semana.tipo === 'vuelta' && a.tipo === 'vuelta' && a.propuesta.carga_sugerida_kg === 65 && a.propuesta.series === 2 && a.motivo === 'Vuelta tras 16 días sin entrenar: −20 % de kilos, una serie menos', 'parón de 16 días: vuelta con −20 % y una serie menos');
  check(a.alternativas[0].propuesta.carga_sugerida_kg === 80 && r.semana.resumen.bajan === 5, 'la alternativa es volver sin recortar');
  check(proponerSemana(entrada({ contexto: { diasSinEntrenar: 7 } })).semana.tipo === 'normal' && proponerSemana(entrada({ contexto: { diasSinEntrenar: 10 } })).semana.tipo === 'vuelta', 'una semana entre sesiones no es un parón; diez días, sí');
}
{
  const r = proponerSemana(entrada({ atleta: { perfil: 'mantenimiento' } }));
  check(r.semana.tipo === 'mantenimiento' && r.filas.every((x) => x.propuesta.series === 2) && r.filas[0].propuesta.carga_sugerida_kg === 80, 'mantenimiento: la mitad de las series, mismas cargas');
}
{
  const molestias = [{ zona: 'hombros', intensidad: 2 }, { zona: 'aductor', intensidad: 1 }, { zona: 'cuadriceps', intensidad: 0 }];
  const r = proponerSemana(entrada({ contexto: { molestias } }));
  const f = Object.fromEntries(r.filas.map((x) => [x.pauta_id, x]));
  check(f.a.tipo === 'subir' && f.a.avisos.some((x) => x.tipo === 'molestia' && x.texto === 'Molestia moderada en hombros') && f.b.avisos.length === 1 && f.c.avisos.length === 0, 'molestias: se avisan en los ejercicios de esa zona y no frenan');
  check(r.semana.avisos.length === 1 && r.semana.avisos[0].zona === 'aductor', 'una zona sin ejercicios asignables se avisa a nivel de semana');
  const frena = proponerSemana(entrada({ contexto: { molestias }, reglas: { atleta: { molestias: 'moderada' } } }));
  const a = frena.filas.find((x) => x.pauta_id === 'a');
  check(a.tipo === 'mantener' && a.propuesta.carga_sugerida_kg === 80 && a.frenos.some((x) => x.id === 'molestia') && a.confianza === 'media', 'si las reglas de un atleta piden frenar con molestia moderada, frena');
  check(cargaZona('hombros', ejercicios.banca) && !cargaZona('hombros', ejercicios.sent) && cargaZona('zona_lumbar', ejercicios.sent) && !cargaZona('zona_lumbar', ejercicios.curl) && !cargaZona('aductor', ejercicios.sent), 'de la zona al ejercicio');
}
{
  // Triple progresión en laterales: sube una serie, salvo check-in bajo o tope de la semana
  const e = entrada({ reglas: { porEjercicio: { lat: { modelo: 'triple' } } } });
  e.series.b = [S(1, 8, 15, 8), S(2, 8, 15, 8), S(3, 8, 15, 8)];
  const b = (r) => r.filas.find((x) => x.pauta_id === 'b');
  const r = proponerSemana(e);
  check(b(r).modelo === 'triple' && b(r).tipo === 'series' && b(r).propuesta.series === 4 && r.semana.resumen.seriesPorGrupo.despues.deltoides === 5.5, 'triple: una serie más y el recuento por músculo lo refleja');
  const bajo = proponerSemana({ ...e, contexto: { checkins: [{ semana_inicio: '2026-10-26', energia: 2, recuperacion: 4 }] } });
  check(b(bajo).tipo === 'mantener' && b(bajo).propuesta.series === 3 && b(bajo).frenos.some((x) => x.id === 'checkin_bajo'), 'con el check-in bajo no se añade la serie');
  const tope = proponerSemana({ ...e, atleta: { nivel: 'intermedio', volumen_objetivo: { deltoides: [2, 4.5] } } });
  check(b(tope).tipo === 'mantener' && b(tope).frenos.some((x) => x.id === 'tope_semana'), 'por encima del máximo del músculo no se añade la serie');
}
{
  const ck = [{ semana_inicio: '2026-10-19', energia: 2, recuperacion: 3 }, { semana_inicio: '2026-10-26', energia: 2, recuperacion: 2 }];
  const r = proponerSemana(entrada({ contexto: { checkins: ck } }));
  check(r.semana.tipo === 'normal' && r.descarga.propuesta && !r.descarga.recomendada && r.descarga.senales[0].id === 'checkin' && r.descarga.filas.length === 5, 'una señal: la descarga se propone aparte y la semana normal sigue');
  const da = r.descarga.filas.find((x) => x.pauta_id === 'a');
  check(da.tipo === 'descarga' && da.propuesta.carga_sugerida_kg === 72.5 && da.propuesta.series === 2 && da.propuesta.rpe_objetivo === 7 && da.alternativas[0].etiqueta === 'Sin descarga', 'la versión de descarga de cada fila');
  const dos = proponerSemana(entrada({ contexto: { checkins: ck, carga: { ratio: 1.7 } } }));
  check(dos.descarga.recomendada && dos.descarga.senales.length === 2, 'dos señales: recomendada');
  const pedida = proponerSemana(entrada({ contexto: { focoSiguiente: 'descarga' } }));
  check(pedida.semana.tipo === 'descarga' && pedida.filas.every((x) => x.tipo === 'descarga') && pedida.sinDescarga.length === 5 && !pedida.descarga.propuesta, 'si marcas la semana como descarga, la propuesta es la descarga');
  const prog = proponerSemana(entrada({ reglas: { atleta: { descarga: { cuando: 'mixta', cadaSemanas: 5 } } }, contexto: { semanasDesdeDescarga: 4 } }));
  check(prog.semana.tipo === 'descarga' && proponerSemana(entrada({ contexto: { semanasDesdeDescarga: 9 } })).semana.tipo === 'normal', 'descarga por calendario solo si las reglas la piden');
  const vol = proponerSemana(entrada({ atleta: { perfil: 'intermedio_fuerza' }, contexto: { focoSiguiente: 'descarga' } }));
  check(vol.filas.find((x) => x.pauta_id === 'a').propuesta.series === 2 && vol.filas.find((x) => x.pauta_id === 'a').propuesta.carga_sugerida_kg === 80, 'el tipo de descarga sale del perfil (de volumen)');
}
{
  // Tras una descarga se parte de la última semana normal
  const e = entrada({ contexto: { focoAnterior: 'descarga' } });
  e.pautas[0] = { ...e.pautas[0], carga_sugerida_kg: 72.5, series: 2 };
  e.series.a = [S(1, 72.5, 12, 6), S(2, 72.5, 12, 6)];
  e.historial = { ...historial, banca: [...antesDe('banca', 77.5, [12, 12, 10]), { foco: 'volumen', pauta: P({ carga_sugerida_kg: 80 }), series: [S(1, 80, 12, 8), S(2, 80, 12, 8), S(3, 80, 12, 8)] }] };
  const r = proponerSemana(e);
  const a = r.filas.find((x) => x.pauta_id === 'a');
  check(r.semana.retoma && a.propuesta.carga_sugerida_kg === 82.5 && a.propuesta.series === 3 && a.motivo.startsWith('Tras la descarga') && a.frenos.some((x) => x.id === 'tras_descarga'), 'tras la descarga: sigue desde la última semana normal');
  const sin = proponerSemana({ ...e, historial: {} });
  check(sin.filas.find((x) => x.pauta_id === 'a').tipo === 'mantener' && sin.filas.find((x) => x.pauta_id === 'a').confianza === 'baja' && sin.filas.find((x) => x.pauta_id === 'a').frenos.some((x) => x.id === 'tras_descarga'), 'sin semana normal anterior: se mantiene, se avisa y la confianza es baja');
}
{
  const e = entrada({ reglas: { porPauta: { a: { modelo: 'a_mano' } } } });
  const a = (r) => r.filas.find((x) => x.pauta_id === 'a');
  check(a(proponerSemana(e)).tipo === 'sin_tocar' && !a(proponerSemana(e)).cambia, 'a mano: no se toca');
  check(a(proponerSemana({ ...e, contexto: { diasSinEntrenar: 30 } })).tipo === 'sin_tocar' && a(proponerSemana({ ...e, contexto: { focoSiguiente: 'descarga' } })).tipo === 'sin_tocar', 'a mano: tampoco en una vuelta ni en una descarga');
}
{
  const r = proponerSemana(entradaBase({ atleta: { perfil: 'intermedio_fuerza' } }));
  const a = r.filas.find((x) => x.pauta_id === 'a');
  check(a.modelo === 'por_serie' && a.modeloPedido === 'top_set' && a.confianza === 'media' && a.avisos.some((x) => x.texto.includes('Top set')), 'modelo que aún no está: el de partida, avisado y con confianza media');
  const nov = proponerSemana(entradaBase({ atleta: { perfil: 'novato_lineal' } }));
  check(nov.filas.find((x) => x.pauta_id === 'a').modelo === 'lineal' && nov.filas.find((x) => x.pauta_id === 'b').modelo === 'doble', 'perfil lineal: lineal en el básico y doble en el resto');
}
{
  // Lineal con historial: dos semanas fallando la misma carga
  const p = P({ id: 'c', sesion_id: 's2', ejercicio_id: 'sent', carga_sugerida_kg: 100, reps_min: 5, reps_max: 5, rpe_objetivo: null });
  const falla = [S(1, 100, 5), S(2, 100, 4), S(3, 100, 3)];
  const e = { sesiones: [{ id: 's2', orden: 1, completada: true }], pautas: [p], series: { c: falla }, ejercicios, atleta: { perfil: 'novato_lineal' },
    historial: { sent: [{ foco: 'volumen', pauta: P({ ...p, carga_sugerida_kg: 97.5 }), series: [S(1, 97.5, 5), S(2, 97.5, 5), S(3, 97.5, 5)] }, { foco: 'volumen', pauta: p, series: falla }] } };
  const r = proponerSemana(e).filas[0];
  check(r.modelo === 'lineal' && r.tipo === 'bajar' && r.propuesta.carga_sugerida_kg === 90, 'lineal: cuenta los fallos seguidos con la misma carga');
  const uno = proponerSemana({ ...e, historial: { sent: [e.historial.sent[0]] } }).filas[0];
  check(uno.tipo === 'mantener', 'lineal: el primer fallo solo repite');
}
{
  // Readaptación: tope de RPE
  const r = proponerSemana(entrada({ atleta: { perfil: 'readaptacion' } }));
  const a = r.filas.find((x) => x.pauta_id === 'a');
  check(a.propuesta.rpe_objetivo === 7 && a.frenos.some((x) => x.id === 'rpe_max') && a.cambios.includes('rpe_objetivo'), 'readaptación: el RPE objetivo no pasa de 7');
}
{
  // Tendencia a la baja en dos obligatorios: señal de rendimiento
  const baja = (id, kg) => [100, 97, 94].map((x, i) => ({ foco: 'volumen', pauta: P({ ejercicio_id: id, carga_sugerida_kg: kg }), series: [S(1, kg, 12 - i * 2, 8), S(2, kg, 12 - i * 2, 8), S(3, kg, 12 - i * 2, 8)] }));
  const e = entrada({ historial: { ...historial, banca: baja('banca', 80), sent: baja('sent', 100) } });
  e.series.a = [S(1, 80, 6, 8), S(2, 80, 6, 8), S(3, 80, 6, 8)];
  e.pautas[2] = { ...e.pautas[2], rpe_objetivo: null };
  e.series.c = [S(1, 100, 5, 8), S(2, 100, 5, 8), S(3, 100, 5, 8)];
  const r = proponerSemana(e);
  check(r.filas.find((x) => x.pauta_id === 'a').tendencia === 'bajando' && r.descarga.senales.some((x) => x.id === 'rendimiento'), 'dos obligatorios a la baja: señal de descarga');
}

console.log('\nMil semanas al azar');
{
  // Generador con semilla: las mismas mil semanas en cada ejecución
  let semilla = 20261105;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
  const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
  const uno = (lista) => lista[entre(0, lista.length - 1)];
  const ids = Object.keys(ejercicios);
  const problemas = [];
  const valida = (p, donde) => {
    const mal = (m) => problemas.push(`${donde}: ${m} ${JSON.stringify(p)}`);
    if (!(Number.isInteger(p.series) && p.series >= 1 && p.series <= 20)) mal('series');
    if (p.reps_min != null && p.reps_max != null && p.reps_min > p.reps_max) mal('rango');
    if (p.rpe_objetivo != null && !(p.rpe_objetivo >= 1 && p.rpe_objetivo <= 10)) mal('rpe');
    if (p.rir_objetivo != null && !(p.rir_objetivo >= 0 && p.rir_objetivo <= 10)) mal('rir');
    if (p.carga_sugerida_kg != null && !(p.carga_sugerida_kg >= 0 && p.carga_sugerida_kg <= 9999.99)) mal('kilos');
    if (p.series_detalle != null) {
      if (!Array.isArray(p.series_detalle) || p.series_detalle.length !== p.series || p.backoff_pct != null) mal('detalle');
      else if (p.series_detalle.some((x) => (x.reps != null && !(Number.isInteger(x.reps) && x.reps >= 0)) || (x.kg != null && !(x.kg >= 0)) || (x.rpe != null && !(x.rpe >= 1 && x.rpe <= 10)))) mal('serie del detalle');
    }
    if (p.backoff_pct != null && p.series < 2) mal('top + back-off con una serie');
  };
  for (let n = 0; n < 1000; n++) {
    const nSes = entre(1, 4);
    const sesiones = Array.from({ length: nSes }, (_, i) => ({ id: `s${i}`, orden: i + 1, completada: azar() < 0.8, preparacion: azar() < 0.5 ? { sueno: entre(1, 3), energia: entre(1, 3), molestias: entre(1, 3) } : null }));
    const pautas = [], series = {}, hist = {};
    for (let i = 0; i < entre(1, 8); i++) {
      const id = `p${i}`, ejercicio_id = uno(ids), nSeries = entre(1, 5), min = entre(3, 12), max = min + entre(0, 5), kg = azar() < 0.2 ? null : entre(2, 60) * 2.5;
      const forma = azar();
      const pauta = P({ id, sesion_id: uno(sesiones).id, ejercicio_id, orden: i, prioridad: uno(['alta', 'media', 'baja', 'muy_baja']), series: nSeries, reps_min: azar() < 0.05 ? null : min, reps_max: azar() < 0.05 ? null : max,
        carga_sugerida_kg: kg, rpe_objetivo: azar() < 0.6 ? entre(12, 19) / 2 : null, rir_objetivo: azar() < 0.15 ? entre(0, 4) : null });
      if (forma < 0.25) { pauta.series_detalle = Array.from({ length: nSeries }, () => ({ reps: entre(min, max), ...(kg != null ? { kg: kg + entre(-1, 1) * 2.5 } : {}), ...(azar() < 0.5 ? { rpe: entre(12, 19) / 2 } : {}) })); pauta.reps_min = Math.min(...pauta.series_detalle.map((x) => x.reps)); pauta.reps_max = Math.max(...pauta.series_detalle.map((x) => x.reps)); }
      else if (forma < 0.35 && nSeries >= 2) pauta.backoff_pct = uno([5, 10, 15]);
      pautas.push(pauta);
      const hechas = () => Array.from({ length: entre(0, nSeries + 1) }, (_, k) => S(k + 1, azar() < 0.05 ? entre(1, 400) : kg == null ? uno([0, null, 20]) : kg + entre(-2, 2) * 2.5, azar() < 0.05 ? 0 : entre(Math.max(1, min - 3), max + 2),
        azar() < 0.7 ? entre(10, 20) / 2 : null, azar() < 0.05 ? { sustituto_id: 'otro' } : {}));
      series[id] = hechas();
      if (azar() < 0.7) hist[ejercicio_id] = Array.from({ length: entre(1, 4) }, () => ({ foco: uno(['volumen', 'intensidad', 'descarga']), pauta: { ...pauta, carga_sugerida_kg: kg == null ? null : kg + entre(-2, 1) * 2.5 }, series: hechas(), malDia: azar() < 0.1 }));
    }
    const porEjercicio = Object.fromEntries(ids.filter(() => azar() < 0.3).map((k) => [k, { modelo: uno(['por_serie', 'doble', 'triple', 'lineal', 'solo_reps', 'mantener', 'a_mano', 'apre']) }]));
    const e = congelar({ pautas, sesiones, series, ejercicios, historial: hist, atleta: { nivel: uno(['novato', 'novato_intermedio', 'intermedio', 'avanzado', null]), perfil: azar() < 0.1 ? uno(['casa', 'readaptacion', 'mantenimiento']) : null },
      reglas: { porEjercicio, atleta: azar() < 0.3 ? { doble: { criterio: uno(['todas', 'todas_menos_una', 'primera', 'suma']), sobrado: uno([1, 2]) }, molestias: uno(['avisar', 'moderada']), soloReps: { sube: uno(['una_total', 'una_cada_serie']) }, porSerie: { variasAlTope: uno(['todas', 'primera', 'faciles']), sinKilos: uno(['no_tocar', 'solo_reps', 'como_los_demas']), sobradoEn: uno(['basicos', 'todos', 'ninguno']) } } : null },
      contexto: { diasSinEntrenar: azar() < 0.1 ? entre(0, 40) : null, focoAnterior: azar() < 0.1 ? 'descarga' : 'volumen', focoSiguiente: azar() < 0.1 ? 'descarga' : null, carga: azar() < 0.2 ? { ratio: 1.6 } : null,
        molestias: azar() < 0.3 ? [{ zona: uno(['hombros', 'cuadriceps', 'zona_lumbar', 'otra']), intensidad: entre(0, 3) }] : [], checkins: azar() < 0.4 ? [{ semana_inicio: '2026-10-19', energia: entre(1, 5), recuperacion: entre(1, 5) }, { semana_inicio: '2026-10-26', energia: entre(1, 5), recuperacion: entre(1, 5) }] : [] } });
    let r;
    try { r = proponerSemana(e); } catch (err) { problemas.push(`semana ${n}: ${err.stack.split('\n').slice(0, 3).join(' | ')}`); continue; }
    if (r.filas.length !== pautas.length) problemas.push(`semana ${n}: faltan filas`);
    for (const lista of [r.filas, r.descarga.filas || [], r.sinDescarga || []]) {
      for (const f of lista) {
        valida(f.propuesta, `semana ${n}, ${f.pauta_id} (${f.tipo}, ${f.modelo})`);
        f.alternativas.forEach((a) => valida(a.propuesta, `semana ${n}, ${f.pauta_id}, alternativa ${a.id}`));
        if (!f.motivo || !['alta', 'media', 'baja'].includes(f.confianza)) problemas.push(`semana ${n}, ${f.pauta_id}: sin motivo o sin confianza`);
        if (f.alternativas.length > 2) problemas.push(`semana ${n}, ${f.pauta_id}: más de dos alternativas`);
        if (f.modelo === 'a_mano' && (f.cambia || f.tipo !== 'sin_tocar')) problemas.push(`semana ${n}, ${f.pauta_id}: toca un ejercicio a mano`);
        if (f.cambia !== (f.cambios.length > 0)) problemas.push(`semana ${n}, ${f.pauta_id}: «cambia» no cuadra`);
        const mas = (c) => f.propuesta[c] != null && f.antes[c] != null && f.propuesta[c] > f.antes[c] + 0.001;
        // Nunca sube dos cosas a la vez sobre lo que hizo (se compara con la carga de trabajo, no con la pautada)
        if (r.semana.tipo === 'normal' && !r.semana.retoma && lista === r.filas && mas('series') && f.tipo !== 'series') problemas.push(`semana ${n}, ${f.pauta_id}: suben las series sin ser ese el cambio (${f.tipo})`);
        if (['descarga', 'vuelta', 'mantenimiento'].includes(f.tipo)) {
          // Un recorte nunca sube nada: ni series, ni esfuerzo, ni kilos (la descarga parte de lo que movió, si fue más)
          const esfuerzo = (q) => (q.rir_objetivo != null ? 10 - q.rir_objetivo : q.rpe_objetivo);
          // (tras otra descarga, lo que movió es lo de la última semana normal, que está en el historial)
          const kgHecho = f.tipo !== 'descarga' ? 0 : Math.max(0, ...(r.semana.retoma ? (hist[f.ejercicio_id] || []).flatMap((h) => h.series) : series[f.pauta_id] || []).map((x) => Number(x.kg) || 0));
          const a = f.antes, q = f.propuesta;
          const sube = q.series > a.series
            || (a.series_detalle
              ? q.series_detalle.some((x) => x.kg != null && x.kg > Math.max(...a.series_detalle.map((y) => y.kg ?? 0)) + 0.001) || q.series_detalle.some((x) => x.rpe != null && x.rpe > Math.max(...a.series_detalle.map((y) => y.rpe ?? 0)) + 0.001)
              : (q.carga_sugerida_kg != null && q.carga_sugerida_kg > Math.max(a.carga_sugerida_kg ?? 0, kgHecho) + 0.001) || (esfuerzo(q) != null && esfuerzo(a) != null && esfuerzo(q) > esfuerzo(a) + 0.001));
          if (sube) problemas.push(`semana ${n}, ${f.pauta_id}: un recorte que sube algo (${f.tipo}) ${JSON.stringify(a)} -> ${JSON.stringify(q)} hecho ${f.hecho}`);
        }
        if (f.tipo === 'series' && f.propuesta.series !== f.antes.series + 1) problemas.push(`semana ${n}, ${f.pauta_id}: «una serie más» no es una`);
      }
    }
    if (!igual(proponerSemana(e), r)) problemas.push(`semana ${n}: no es determinista`);
  }
  problemas.slice(0, 12).forEach((x) => console.log('    ·', x));
  check(problemas.length === 0, `mil semanas al azar: ni un fallo, ni una pauta inválida (${problemas.length} problemas)`);
}

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
if (fallos) process.exit(1);
